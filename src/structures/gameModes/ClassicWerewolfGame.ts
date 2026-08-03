import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  GuildTextBasedChannel,
  inlineCode,
  Message,
  MessageFlags,
  userMention,
} from 'discord.js';
import { sleep } from 'bun';
import { BaseGameManager } from '../BaseGameManager';
import { GameError } from '../../errors/GameError';
import { announcementComponent } from '../../components/announcementComponent';
import { assignRolesComponent } from '../../components/assignRolesComponent';
import { checkGameDetailsComponent } from '../../components/checkGameDetailsComponent';
import { dayNightComponent } from '../../components/dayNightComponent';
import { selectPerformActionUserMenu } from '../../components/selectUserMenu';
import { votingComponentBuilder } from '../../components/votingComponentBuilder';
import { GameFlags } from '../GameState';
import { Player, PlayerFlags } from '../PlayerManager';
import { ASSETS } from '../../utils/asset_utils';
import { log } from '../../utils/logger';
import { emojiCollection } from '../../constants/emojis';
import { shuffleArray } from '../../utils/shuffle_array';
import { autoDelete, safeReply } from '../../utils/interaction';
import { GameInfoConstants } from '../../constants/GameInfo';
import { ActivityState, GamePhase, LifeStatus } from '../../types/states';
import {
  BTN_IDS,
  MAX_PLAYER_IN_GAME,
  MIN_PLAYER_IN_GAME,
  PHASE_CHANGE_DURATION,
  PHASE_UPDATE_DURATION,
  POLL_DURATION,
  SLEEP_DURATION,
} from '../../types/globals';

import { PhaseDefinition } from '../../types/gameModes';
import { RBoolean } from '../../types/types';
import { clearVotes, getSubPhase, getVotes, recordVote, setSubPhase } from '../gameSession';
import { PlayerActions, Phases, PlayerRoles, PlayerRole } from './classic';

export class ClassicWerewolfGame extends BaseGameManager {
  gameModeId = 'Classic Warewolf';
  minPlayers = MIN_PLAYER_IN_GAME;
  maxPlayers = MAX_PLAYER_IN_GAME;

  phaseSequence(): PhaseDefinition[] {
    return [
      {
        id: 'day',
        duration: PHASE_CHANGE_DURATION,
        run: (m, channel) => (m as ClassicWerewolfGame).runDayPhase(channel),
      },
      {
        id: 'night',
        duration: PHASE_CHANGE_DURATION,
        run: (m, channel) => (m as ClassicWerewolfGame).runNightPhase(channel),
        resolve: (m, channel) => (m as ClassicWerewolfGame).resolveNightPhase(channel),
      },
      {
        id: 'voting',
        duration: PHASE_CHANGE_DURATION,
        run: (m, channel) => (m as ClassicWerewolfGame).runVotingPhase(channel),
        resolve: (m, channel) => (m as ClassicWerewolfGame).resolveVotingPhase(channel),
      },
    ];
  }

  winCondition(): boolean {
    if (this.state._flags & GameFlags.IsInactive) return true;

    const alive = this.state.getAlivePlayers();
    const imposters = alive.filter((p) => p.role === PlayerRoles.IMPOSTER);
    const townies = alive.filter((p) => p.role !== PlayerRoles.IMPOSTER);

    if (imposters.length === 0) return true;
    if (imposters.length >= townies.length) return true;

    return false;
  }

  private async assignRoles(role: PlayerRole, ratio: number, defaultRole?: PlayerRole) {
    ratio = Math.max(ratio, 0.1);
    ratio = Math.min(ratio, 1);

    const players = defaultRole
      ? shuffleArray(this.activePlayers()).filter((p: Player) => p.role === defaultRole)
      : shuffleArray(this.activePlayers());

    const nCount = players.filter((p: Player) => p.role === role).length;

    const nPlayers = Math.floor(players.length * ratio - nCount);

    const slice = players.slice(0, nPlayers);

    slice.forEach((p: Player) => {
      p._role = role;
      this.state.setPlayer(p.id, p);
    });

    await this.save();
  }

  async onGameStart(channel: GuildTextBasedChannel): Promise<void> {
    if (this.activePlayerCount() < this.minPlayers) {
      throw new GameError('Could not start the game. Not enough active players. Try again later.', 'GAME_MIN_PLAYER_ERROR');
    }

    setSubPhase(this.channelId, Phases.DAY);
    this.state._phase = GamePhase.IN_GAME;

    await this.assignRoles(PlayerRoles.TOWNIE, 1);
    await this.assignRoles(PlayerRoles.IMPOSTER, 0.34);
    await this.assignRoles(PlayerRoles.DOCTOR, 0.16, PlayerRoles.TOWNIE);

    const shuffledPlayers = shuffleArray(this.activePlayers());

    shuffledPlayers.forEach((p) => {
      p.activityState = ActivityState.IN_GAME;
      p.lifeStatus = LifeStatus.ALIVE;
    });

    const response = await channel.send({
      components: [assignRolesComponent({ players: this.activePlayers(), mode: GameInfoConstants.classic })],
      flags: MessageFlags.IsComponentsV2,
    });

    await new Promise((resolve) => {
      const collector = response.createMessageComponentCollector({
        componentType: ComponentType.Button,
        filter: (i) => i.customId === BTN_IDS.ASSIGN_ROLE_BTN,
        time: (PHASE_CHANGE_DURATION / 3) * 1000,
      });

      collector.on('collect', async (i) => {
        const player = this.activePlayer(i.member.id);
        if (!player) return;
        player.isAfk = false;
        await safeReply(i, { content: roleMessage(player.role), flags: [MessageFlags.Ephemeral] });
      });

      collector.on('end', async () => {
        this.activePlayers().forEach((p) => {
          if (p.isBot) p.isAfk = false;
        });
        await response.delete().catch(() => {});
        resolve(0);
      });
    });

    const retained = this.activePlayers().filter((p) => !p.isAfk);
    const somePlayersWereAfk = retained.length < this.activePlayers().length;
    this.state.setPlayers(retained);
    await this.save();

    if (somePlayersWereAfk) {
      await this.assignRoles(PlayerRoles.IMPOSTER, 0.25, PlayerRoles.TOWNIE);
      await this.assignRoles(PlayerRoles.DOCTOR, 0.16, PlayerRoles.TOWNIE);

      await channel.send({
        components: [
          announcementComponent({
            title: 'Key players were afk',
            messages: ['Some key players were afk, roles have been reassigned, please recheck your role'],
          }),
        ],
        flags: MessageFlags.IsComponentsV2,
      });
      await this.save();
    }
  }

  async onGameEnd(channel: GuildTextBasedChannel): Promise<void> {
    if (this.state._flags & GameFlags.IsInactive) {
      await channel.send({
        components: [
          announcementComponent({
            messages: ['Seems like everyone got busy :('],
            imageUrl: ASSETS.GAMEOVER_URL,
          }),
        ],
        flags: MessageFlags.IsComponentsV2,
      });
      return;
    }

    const alive = this.state.getAlivePlayers();
    const imposters = alive.filter((p) => p.role === PlayerRoles.IMPOSTER);
    const winRole = imposters.length === 0 ? PlayerRoles.TOWNIE : PlayerRoles.IMPOSTER;
    const winnerName = winRole === PlayerRoles.IMPOSTER ? 'Imposters' : 'Townies';

    const winnerMembers = this.state
      .getPlayers()
      .filter((p) => (winRole === PlayerRoles.IMPOSTER ? p.role === PlayerRoles.IMPOSTER : p.role !== PlayerRoles.IMPOSTER));

    const mentions = winnerMembers.map((p) => userMention(p.id)).join(' ');

    await channel.send({
      components: [
        announcementComponent({
          messages: [`The **${winnerName}** win the game!`, mentions],
          imageUrl: ASSETS.GAMEOVER_URL,
        }),
      ],
      flags: MessageFlags.IsComponentsV2,
    });
  }

  async handleInGameMessage(msg: Message): Promise<void> {
    if (this.getPhase() !== GamePhase.IN_GAME) return;

    const subPhase = this.getSubPhase();
    if (subPhase !== Phases.NIGHT && subPhase !== Phases.VOTING) return;

    if (msg.deletable) await msg.delete().catch(() => {});

    const channel = msg.channel as GuildTextBasedChannel;
    const notice = await channel.send(
      `${userMention(msg.author.id)} You can only send messages during the day - night and voting are silent.`,
    );
    autoDelete(notice, 3_000);
  }

  private async handleVoting(playerId: string, voteValue: string): Promise<RBoolean> {
    const player = this.state.getPlayer(playerId);

    if (!player) {
      return { ok: false, error: new GameError('You are not part of this game', 'INVALID_PLAYER') };
    }

    if (getSubPhase(this.channelId) !== Phases.VOTING) {
      return { ok: false, error: new GameError('Voting is not active right now', 'GAME_INVALID_STATE') };
    }

    if (player.lifeStatus !== LifeStatus.ALIVE) {
      return { ok: false, error: new GameError("Dead players can't vote", 'PLAYER_INVALID_STATE_ERROR') };
    }

    if (player.has(PlayerFlags.HasVoted)) {
      return {
        ok: false,
        error: new GameError("You can't vote twice in the same round", 'PLAYER_INVALID_STATE_ERROR'),
      };
    }

    recordVote(this.channelId, playerId, voteValue);
    player.setFlag(PlayerFlags.HasVoted);
    await this.save();
    return { ok: true };
  }

  private async handleKillAndSave(player: Player, target: Player): Promise<RBoolean> {
    if (player.has(PlayerFlags.HasPerformedAction)) {
      return { ok: false, error: new GameError('You have already performed an action for this night', 'INVALID_ACTION') };
    }

    if (player.id === target.id) {
      return { ok: false, error: new GameError("You can't target yourself", 'INVALID_ACTION') };
    }

    if (getSubPhase(this.channelId) !== Phases.NIGHT) {
      return { ok: false, error: new GameError('You can perform actions only at night', 'GAME_INVALID_STATE') };
    }

    switch (player.role) {
      case PlayerRoles.IMPOSTER:
        if (target.role === PlayerRoles.IMPOSTER) {
          return { ok: false, error: new GameError("Can't perform action on your partner", 'INVALID_ACTION') };
        }

        target.setFlag(PlayerFlags.WasKilled);
        player.setFlag(PlayerFlags.HasPerformedAction);
        await this.save();
        return { ok: true };

      case PlayerRoles.DOCTOR:
        target.setFlag(PlayerFlags.WasSaved);
        player.setFlag(PlayerFlags.HasPerformedAction);
        await this.save();
        return { ok: true };

      default:
        return { ok: false, error: new GameError("Can't perform action", 'INVALID_ACTION') };
    }
  }

  async _handlePerformAction(playerId: string, args: string[]): Promise<RBoolean> {
    if (args.length < 2) {
      return {
        ok: false,
        error: new GameError(
          'Invalid action, args length less than 2: ' + args + 'gameMode: ' + this.gameModeId,
          'INVALID_ACTION',
        ),
      };
    }

    const player = this.state.getPlayer(playerId);
    if (!player) {
      return { ok: false, error: new GameError('You are not part of this game', 'INVALID_PLAYER') };
    }

    if (player.lifeStatus !== LifeStatus.ALIVE) {
      return {
        ok: false,
        error: new GameError("You can't perform this action, you are dead", 'PLAYER_INVALID_STATE_ERROR'),
      };
    }

    const action = args[0] as string;

    if (action === PlayerActions.VOTE) {
      return await this.handleVoting(playerId, args[1]);
    }

    if (player.role === PlayerRoles.DOCTOR) {
      switch (action) {
        case PlayerActions[player.role].SAVE:
          const target = this.state.getPlayer(args[1]);
          if (!target) {
            return {
              ok: false,
              error: new GameError('Most likely, something went wrong, please tag the creator to this', 'INVALID_PLAYER'),
            };
          }
          return await this.handleKillAndSave(player, target);
      }
    }

    if (player.role === PlayerRoles.IMPOSTER) {
      switch (action) {
        case PlayerActions[player.role].KILL:
          const target = this.state.getPlayer(args[1]);
          if (!target) {
            return {
              ok: false,
              error: new GameError('Most likely, something went wrong, please tag the creator to this', 'INVALID_PLAYER'),
            };
          }
          return await this.handleKillAndSave(player, target);
      }
    }

    if (player.role === PlayerRoles.TOWNIE) {
      switch (action) {
        case PlayerActions[player.role].WORK:
          ///coming soon
          return { ok: true };
        //pass
      }
    }

    log.error(`Something went wrong [handle_perform_action: ${action}, ${player.toJSON()}]`);
    return { ok: false, error: new Error(`Something went wrong [handle_perform_action]`) };
  }

  /* ---------------------------------------------------------------- phase implementations */

  private async runDayPhase(channel: GuildTextBasedChannel) {
    setSubPhase(this.channelId, Phases.DAY);

    const players = this.activePlayers();
    const playerMap = (id: string) => this.activePlayer(id);

    const dayMessageResponse = await channel.send({
      components: [
        dayNightComponent({ phase: Phases.DAY, players, timer: PHASE_CHANGE_DURATION, round: this.state._round }),
      ],
      flags: MessageFlags.IsComponentsV2,
    });

    await new Promise((resolve) => {
      let phaseChangeCountDown = PHASE_CHANGE_DURATION;

      const collector = dayMessageResponse.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: PHASE_CHANGE_DURATION * 1000,
      });

      const interval = setInterval(async () => {
        try {
          phaseChangeCountDown -= PHASE_UPDATE_DURATION;

          await dayMessageResponse.edit({
            components: [
              dayNightComponent({ phase: Phases.DAY, players, timer: phaseChangeCountDown, round: this.state._round }),
            ],
            flags: MessageFlags.IsComponentsV2,
          });

          if (phaseChangeCountDown <= 0) {
            clearInterval(interval);
            collector.stop();
            resolve(0);
          }
        } catch (e) {
          log.error(e);
          clearInterval(interval);
          collector.stop();
          resolve(0);
        }
      }, PHASE_UPDATE_DURATION * 1000);

      collector.on('collect', async (btn) => {
        const player = playerMap(btn.member.id);

        if (!player) {
          collector.stop();
          return await safeReply(btn, { content: 'You are not currently in this game', flags: [MessageFlags.Ephemeral] });
        }

        if (player.lifeStatus === LifeStatus.DEAD) {
          collector.stop();
          return await safeReply(btn, { content: 'You are currently dead', flags: [MessageFlags.Ephemeral] });
        }

        collector.stop();
        return await safeReply(btn, {
          components: [
            checkGameDetailsComponent({ role: player.role, phase: this.getSubPhase(), round: this.state._round }),
          ],
          flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral],
        });
      });
    });
  }

  private async runNightPhase(channel: GuildTextBasedChannel) {
    setSubPhase(this.channelId, Phases.NIGHT);

    const players = this.activePlayers();
    const playerMap = (id: string) => this.activePlayer(id);

    const nightMessageResponse = await channel.send({
      components: [
        dayNightComponent({ phase: Phases.NIGHT, players, timer: PHASE_CHANGE_DURATION, round: this.state._round }),
      ],
      flags: MessageFlags.IsComponentsV2,
    });

    await new Promise((resolve) => {
      const collector = nightMessageResponse.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: PHASE_CHANGE_DURATION * 1000,
      });

      let phaseChangeCountDown = PHASE_CHANGE_DURATION;

      const interval = setInterval(async () => {
        try {
          phaseChangeCountDown -= PHASE_UPDATE_DURATION;
          await nightMessageResponse.edit({
            components: [
              dayNightComponent({
                phase: this.getSubPhase(),
                players,
                round: this.state._round,
                timer: phaseChangeCountDown,
              }),
            ],
            flags: MessageFlags.IsComponentsV2,
          });

          if (phaseChangeCountDown <= 0) {
            collector.stop();
          }
        } catch (e) {
          log.error(e);
          clearInterval(interval);
          collector.stop();
          resolve(0);
        }
      }, PHASE_UPDATE_DURATION * 1000);

      collector.on('end', async () => {
        clearInterval(interval);
        resolve(0);
      });

      collector.on('collect', async (btn) => {
        const player = playerMap(btn.member.id);

        if (!player) {
          return await safeReply(btn, { content: 'You are not currently in this game', flags: [MessageFlags.Ephemeral] });
        }

        if (player.lifeStatus === LifeStatus.DEAD) {
          return await safeReply(btn, { content: 'You are currently dead', flags: [MessageFlags.Ephemeral] });
        }

        if (btn.customId === BTN_IDS.PERFORM_ACTION_BTN) {
          if (player.role === PlayerRoles.TOWNIE) {
            return await safeReply(btn, {
              content: 'Townie tasks are coming soon!',
              flags: [MessageFlags.Ephemeral],
            });
          }

          return await safeReply(btn, {
            components: [selectPerformActionUserMenu(this.activePlayers(), player)],
            flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral],
          });
        }

        if (btn.customId === BTN_IDS.CHECK_LIFE_STATUS_BTN) {
          const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(BTN_IDS.LAST_MESSAGE_BTN)
              .setLabel('Leave a last message')
              .setStyle(ButtonStyle.Danger),
          );

          if (player.has(PlayerFlags.WasKilled)) {
            return await safeReply(btn, {
              content:
                "Sadly you were killed. It's possible you can still get revived, if a doctor passes by the end of the night",
              flags: MessageFlags.Ephemeral,
              components: [row],
            });
          }

          return await safeReply(btn, {
            content: "Phewww that was some relief, so far, you have not yet been killed, let's hope it remains like this",
            flags: MessageFlags.Ephemeral,
          });
        }

        if (btn.customId === BTN_IDS.CHECK_GAME_TIME_BTN) {
          return await safeReply(btn, {
            components: [
              checkGameDetailsComponent({ role: player.role, phase: this.getSubPhase(), round: this.state._round }),
            ],
            flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral],
          });
        }
      });
    });
  }

  private async resolveNightPhase(channel: GuildTextBasedChannel) {
    const msgs: string[] = [];

    await channel.send({
      components: [announcementComponent({ imageUrl: ASSETS.BREAKING_NEWS_URL })],
      flags: MessageFlags.IsComponentsV2,
    });

    await sleep(SLEEP_DURATION * 1000);

    for (const player of this.activePlayers()) {
      if (player.hasAllFlags([PlayerFlags.WasKilled, PlayerFlags.WasSaved])) {
        player.lifeStatus = LifeStatus.ALIVE;
        player.clearFlags();
        msgs.push(`${userMention(player.id)} was attacked, but the doctor saved them.`);
        continue;
      }

      if (player.has(PlayerFlags.WasSaved)) {
        player.lifeStatus = LifeStatus.ALIVE;
        msgs.push(`${userMention(player.id)} AKA (${player.username}) was visited by the doctor but was safe.`);
      }

      if (player.has(PlayerFlags.WasKilled)) {
        player.lifeStatus = LifeStatus.DEAD;
        msgs.push(`${userMention(player.id)} AKA (${player.username}) was a/an (${player.role}) and was brutally murdered.`);
      }

      player.clearFlags();
    }

    if (msgs.length === 0) {
      msgs.push('The night was quiet. No one was disturbed.');
    }

    await channel.send({
      components: [
        announcementComponent({
          messages: msgs,
        }),
      ],
      flags: MessageFlags.IsComponentsV2,
    });

    await sleep(SLEEP_DURATION * 1000);
  }

  private async runVotingPhase(channel: GuildTextBasedChannel) {
    setSubPhase(this.channelId, Phases.VOTING);

    const response = await channel.send({
      components: [
        votingComponentBuilder({
          players: this.activePlayers(),
          timer: PHASE_CHANGE_DURATION,
        }),
      ],
      flags: MessageFlags.IsComponentsV2,
    });

    await new Promise((resolve) => {
      let countdown = PHASE_CHANGE_DURATION;

      const interval = setInterval(async () => {
        try {
          countdown -= PHASE_UPDATE_DURATION;
          await response.edit({
            components: [votingComponentBuilder({ players: this.activePlayers(), timer: countdown })],
            flags: MessageFlags.IsComponentsV2,
          });

          if (countdown <= 0) {
            clearInterval(interval);
            resolve(0);
          }
        } catch (e) {
          log.error(e);
          clearInterval(interval);
          resolve(0);
        }
      }, PHASE_UPDATE_DURATION * 1000);
    });
  }

  private async runEliminationPoll(
    channel: GuildTextBasedChannel,
    player: Player,
    durationMs = POLL_DURATION * 1000,
  ): Promise<boolean> {
    const poll = await channel.send({
      components: [
        announcementComponent({
          messages: [`Do you want to boot off ${userMention(player.id)}?\n\nThe poll lasts for ${POLL_DURATION}s`],
          imageUrl: ASSETS.JUDGEMENT_URL,
        }),
      ],
      flags: MessageFlags.IsComponentsV2,
    });

    await poll.react(emojiCollection.thumbs_up);
    await poll.react(emojiCollection.thumbs_down);
    await sleep(durationMs);

    const container = new Set<string>();
    const up = await this.countReactions(poll, emojiCollection.thumbs_up, container);
    const down = await this.countReactions(poll, emojiCollection.thumbs_down, container);

    return up > down;
  }

  private async countReactions(message: Message, emoji: string, container: Set<string>): Promise<number> {
    const reaction = message.reactions.resolve(emoji);
    if (!reaction) return 0;
    const users = await reaction.users.fetch();
    const res = users.filter((u) => !u.bot && !container.has(u.id));
    res.forEach((u) => container.add(u.id));
    return res.size;
  }

  private async resolveVotingPhase(channel: GuildTextBasedChannel) {
    const votes = getVotes(this.channelId);
    const tally = new Map<string, number>();

    if (votes.size < 1) {
      this.state._flags |= GameFlags.IsInactive;
    }

    for (const [, targetId] of votes) {
      if (targetId === 'skip') continue;
      tally.set(targetId, (tally.get(targetId) ?? 0) + 1);
    }

    if (tally.size === 0) {
      await channel.send({
        components: [announcementComponent({ messages: ['No votes were cast. Nobody was eliminated.'] })],
        flags: MessageFlags.IsComponentsV2,
      });
      clearVotes(this.channelId);
      return;
    }

    let maxVotes = 0;
    let lynched: string | null = null;
    for (const [id, count] of tally) {
      if (count > maxVotes) {
        maxVotes = count;
        lynched = id;
      }
    }

    const tied = [...tally].filter(([_, c]) => c === maxVotes);
    if (tied.length > 1) {
      await channel.send({
        components: [
          announcementComponent({ messages: [`It's a tie between **${tied.length}** players. Nobody was eliminated.`] }),
        ],
        flags: MessageFlags.IsComponentsV2,
      });

      this.activePlayers().forEach((p) => p.clearFlag(PlayerFlags.HasVoted));
      clearVotes(this.channelId);
      return;
    }

    const player = this.activePlayer(lynched!);

    if (player) {
      const booted = await this.runEliminationPoll(channel, player);
      if (booted) {
        player.lifeStatus = LifeStatus.DEAD;
        await channel.send({
          components: [
            announcementComponent({
              messages: [`(${userMention(player.id)}) was a/an (${player.role}) and was eliminated by vote.`],
            }),
          ],
          flags: MessageFlags.IsComponentsV2,
        });
      } else {
        await channel.send({
          components: [announcementComponent({ messages: [`${userMention(player.id)} was redeemed by the vote.`] })],
          flags: MessageFlags.IsComponentsV2,
        });
      }
    }

    this.activePlayers().forEach((p) => p.clearFlag(PlayerFlags.HasVoted));
    clearVotes(this.channelId);
  }
}

function roleMessage(role: string): string {
  switch (role) {
    case PlayerRoles.IMPOSTER:
      return `You are an ${inlineCode('imposter')}, cause some chaos but don't get caught.`;
    case PlayerRoles.DOCTOR:
      return `You are a ${inlineCode('doctor')}, every night you can rescue anyone from the players`;
    default:
      return `You are a ${inlineCode('townie')}, do you best to figure out the bad guy before it is too late`;
  }
}

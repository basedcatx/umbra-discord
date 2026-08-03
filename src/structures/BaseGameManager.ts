import {
  ButtonInteraction,
  Colors,
  CommandInteraction,
  EmbedBuilder,
  GuildTextBasedChannel,
  Message,
  MessageFlags,
} from 'discord.js';
import { GameError } from '../errors/GameError';
import { ActivityState, GamePhase } from '../types/states';
import { LOBBY_BASE_DURATION, LOBBY_MAX_RETRY_COUNT } from '../types/globals';
import { log } from '../utils/logger';
import { safeEditReply, safeReply } from '../utils/interaction';
import { GameState } from './GameState';
import { Player } from './PlayerManager';
import { PhaseDefinition, GameManagerContract } from '../types/gameModes';
import { RBoolean, RVBoolean } from '../types/types';
import { GameStateRepository, gameStateRepository, StoredGameData } from '../storage/gameStateRepository';
import { getGameMode } from './gameModes/registry';
import { clearSession, getSubPhase } from './gameSession';
import { lobbyComponentBuilder } from '../components/lobbyComponentBuilder';
import { LobbyInfo } from '../constants/GameInfo';
import { sleep } from 'bun';

let defaultRepository: GameStateRepository = gameStateRepository;

export function setDefaultGameRepository(repo: GameStateRepository): void {
  defaultRepository = repo;
}

export abstract class BaseGameManager implements GameManagerContract {
  readonly channelId: string;
  state: GameState = new GameState();

  protected repo: GameStateRepository;

  abstract gameModeId: string;
  abstract minPlayers: number;
  abstract maxPlayers: number;

  protected phaseBufferMS = 3 * 1000;

  constructor(channelId: string, repo: GameStateRepository = defaultRepository) {
    this.channelId = channelId;
    this.repo = repo;
  }

  static async fromChannelId(channelId: string, modeId = 'classic'): Promise<RVBoolean<BaseGameManager>> {
    const data = await defaultRepository.load(channelId);

    if (!data) {
      const ModeClass = getGameMode(modeId);
      if (!ModeClass) return { ok: false, error: new GameError(`Unknown game mode: ${modeId}`, 'GAME_INVALID_STATE') };
      return { ok: true, value: new ModeClass(channelId) };
    }

    const ModeClass = getGameMode(data.mode)!;
    const manager = new ModeClass(channelId);
    manager.hydrate(data);
    return { ok: true, value: manager };
  }

  /* ---------------------------------------------------------------- mode hooks */

  abstract phaseSequence(): PhaseDefinition[];
  abstract winCondition(): boolean;
  abstract onGameStart(channel: GuildTextBasedChannel): Promise<void>;
  abstract onGameEnd(channel: GuildTextBasedChannel): Promise<void>;
  abstract _handlePerformAction(_playerId: string, args: string[]): Promise<RBoolean>;
  abstract handleInGameMessage(msg: Message): Promise<void>;

  private parseAction(action: string): string[] {
    return action.split(':');
  }

  async performAction(playerId: string, value: string): Promise<RBoolean> {
    const action = this.parseAction(value);
    if (!action) {
      log.error(`Invalid action provided for: ${this.gameModeId}`);
      return { ok: false, error: new GameError('Invalid Action', 'INVALID_ACTION') };
    }
    return await this._handlePerformAction(playerId, action);
  }

  /* ---------------------------------------------------------------- state accessors */

  public getPhase() {
    return this.state._phase;
  }

  public getSubPhase() {
    return getSubPhase(this.channelId);
  }

  public activePlayers() {
    return this.state.getPlayers();
  }

  public activePlayer(id: string) {
    return this.state.getPlayer(id);
  }

  public activePlayerCount() {
    return this.state.playerCount;
  }

  /* ---------------------------------------------------------------- persistence */

  protected serialize(): StoredGameData {
    return { mode: this.gameModeId, state: JSON.stringify(this.state.toJSON()) };
  }

  protected hydrate(data: StoredGameData): void {
    const raw = data.state;
    if (!raw) return;
    this.state = GameState.fromJSON(JSON.parse(raw));
  }

  public async save(): Promise<void> {
    await this.repo.save(this.channelId, this.serialize());
  }

  public async reload(): Promise<boolean> {
    const data = await this.repo.load(this.channelId);
    if (!data) return false;
    this.hydrate(data);
    return true;
  }

  public async reset(): Promise<void> {
    await this.repo.remove(this.channelId);
    await this.repo.clearLobbyCreator(this.channelId);
    await this.repo.clearGameStartRequest(this.channelId);
    await this.repo.clearLobbyClaim(this.channelId);
    clearSession(this.channelId);
    this.state = new GameState();
  }

  /* ---------------------------------------------------------------- lobby */

  public async createLobby(): Promise<RBoolean> {
    if ((await this.repo.load(this.channelId)) || !(await this.repo.tryCreateLobby(this.channelId))) {
      return {
        ok: false,
        error: new GameError(
          'An ongoing lobby already exists in this channel. You should join it or wait for the next if you are not a part',
          'GAME_IN_PROGRESS',
        ),
      };
    }

    this.state._phase = GamePhase.IN_LOBBY;
    await this.save();
    return { ok: true };
  }

  public async addPlayerToLobby(player: Player): Promise<RBoolean> {
    if (this.getPhase() !== GamePhase.IN_LOBBY) {
      return {
        ok: false,
        error: new GameError(
          'Invalid game state, can not seem to find the active lobby [add_player_state_lobby]',
          'GAME_INVALID_STATE',
        ),
      };
    }

    if (this.state.getPlayer(player.id)) {
      return { ok: false, error: new GameError('You are already in an active lobby', 'PLAYER_NOT_IN_LOBBY') };
    }

    if (this.state.playerCount >= this.maxPlayers) {
      return { ok: false, error: new GameError('This Lobby is currently filled', 'LOBBY_FULL_ERROR') };
    }

    player.activityState = ActivityState.IN_LOBBY;
    this.state.addPlayer(player);
    await this.save();
    return { ok: true };
  }

  public async removePlayerFromLobby(player?: Player): Promise<RBoolean> {
    if (this.getPhase() !== GamePhase.IN_LOBBY) {
      return {
        ok: false,
        error: new GameError(
          'Invalid game state, can not seem to find the active lobby [add_player_state_lobby]',
          'GAME_INVALID_STATE',
        ),
      };
    }

    if (!player || !this.state.getPlayer(player.id)) {
      return { ok: false, error: new GameError('You are not in this lobby', 'PLAYER_NOT_IN_LOBBY') };
    }

    player.resetActivityState();
    this.state.removePlayer(player.id);
    await this.save();
    return { ok: true };
  }

  public async setLobbyCreator(userId: string): Promise<void> {
    await this.repo.setLobbyCreator(this.channelId, userId);
  }

  public async getLobbyCreator(): Promise<string | null> {
    return await this.repo.getLobbyCreator(this.channelId);
  }

  public async requestGameStart(): Promise<void> {
    await this.repo.requestGameStart(this.channelId);
  }

  public async isGameStartRequested(): Promise<boolean> {
    return await this.repo.isGameStartRequested(this.channelId);
  }

  public async startLobby(interaction: CommandInteraction | ButtonInteraction): Promise<void> {
    const channel = interaction.channel as GuildTextBasedChannel;
    let timeRemaining = LOBBY_BASE_DURATION;
    let retryCount = 0;
    const updateInterval = 10;

    const lobbyMessage = (remaining: number) => {
      return lobbyComponentBuilder({
        timeRemaining: remaining,
        header: this.gameModeId,
        body: LobbyInfo.info,
        joined: this.activePlayerCount(),
      });
    };

    const lobbyInteraction = interaction.deferred
      ? await safeEditReply(interaction, { components: lobbyMessage(timeRemaining), flags: MessageFlags.IsComponentsV2 })
      : await safeReply(interaction, { components: lobbyMessage(timeRemaining), flags: MessageFlags.IsComponentsV2 });

    if (!lobbyInteraction) {
      log.error('Failed to send the lobby message, aborting the lobby countdown', { channelId: this.channelId });
      return;
    }

    const countDownInterval = setInterval(async () => {
      await this.reload();

      if (this.getPhase() !== GamePhase.IN_LOBBY) {
        clearInterval(countDownInterval);
        await lobbyInteraction.delete().catch(() => {});
        return;
      }

      timeRemaining -= updateInterval;

      try {
        await lobbyInteraction.edit({
          components: lobbyMessage(timeRemaining),
        });
      } catch (err) {
        log.error('Failed to update lobby', err);
        clearInterval(countDownInterval);
        await this.reset();
        return;
      }

      const startRequested = await this.isGameStartRequested();

      if (timeRemaining <= 0 || (startRequested && this.activePlayerCount() >= this.minPlayers)) {
        if (this.activePlayerCount() >= this.minPlayers) {
          clearInterval(countDownInterval);
          await lobbyInteraction.delete().catch(() => {});
          const res = await this.startGame(interaction);
          if (!res.ok) await channel.send(res.error.message).catch(() => {});
          return;
        }

        retryCount++;
        if (retryCount >= LOBBY_MAX_RETRY_COUNT) {
          clearInterval(countDownInterval);
          await this.reset();
          await channel.send({
            embeds: [
              new EmbedBuilder()
                .setTitle('Lobby closed.')
                .setDescription('Not enough players joined in time.')
                .setColor(Colors.Red),
            ],
            components: [],
          });
          return;
        }

        timeRemaining = LOBBY_BASE_DURATION;
        const needed = this.minPlayers - this.activePlayerCount();
        await channel.send(
          `Time extended! ${needed} more player${needed > 1 ? 's' : ''} needed. ` +
            `You have **${timeRemaining} seconds** (Retry ${retryCount}/${LOBBY_MAX_RETRY_COUNT})`,
        );
      }
    }, updateInterval * 1000);
  }

  /* ---------------------------------------------------------------- game loop */

  public async startGame(interaction: CommandInteraction | ButtonInteraction): Promise<RBoolean> {
    await this.reload();
    if (this.state._phase !== GamePhase.IN_LOBBY) {
      log.error(
        `Invalid state change, you must leave from the lobby state to the game started state: current: ${this.state._phase}`,
      );
      return {
        ok: false,
        error: new GameError(
          'Something went wrong, please report to the developer [game_state_lobby_error] ',
          'GAME_INVALID_STATE',
        ),
      };
    }

    await this.repo.clearLobbyClaim(this.channelId);
    const channel = interaction.channel as GuildTextBasedChannel;

    try {
      await this.onGameStart(channel);
      await this.runGameLoop(channel);
      await this.reload();
      await this.onGameEnd(channel);
    } catch (e) {
      log.error(e);
      await this.reset();
      if (e instanceof GameError) {
        return {
          ok: false,
          error: e,
        };
      }
      return {
        ok: false,
        error: new Error('An error occurred during the game, would be fixed. The game has been reset.'),
      };
    }

    await this.reset();
    return { ok: true };
  }

  /**
   * Runs the phase sequence until `winCondition` is met.
   *
   * `run` steps only drive UI and session state, so they operate on this (reloaded)
   * manager. `resolve` steps mutate persisted game state, so they run inside
   * `mutateGame` on a fresh hydrated manager: the mutation is applied and saved
   * atomically via the per-channel queue, and the win condition is evaluated on the
   * same fresh state that was just persisted.
   */

  private async runGameLoop(channel: GuildTextBasedChannel): Promise<boolean> {
    while (true) {
      let won = (await this.mutateGame<boolean>((m) => m.winCondition())) ?? false;
      if (won) return true;

      for (const phase of this.phaseSequence()) {
        await phase.run?.(this, channel);

        if (phase.resolve) {
          won =
            (await this.mutateGame<boolean>(async (m) => {
              await phase.resolve?.(m, channel);
              await m.save();
              return m.winCondition();
            })) ?? false;

          await this.reload();
          if (won) return true;
        }

        await sleep(this.phaseBufferMS);
      }

      await this.mutateGame(async (m) => {
        m.state._round++;
        await m.save();
      });
      await this.reload();
    }
  }

  /* ---------------------------------------------------------------- mutation helper */

  private static channelQueues = new Map<string, Promise<unknown>>();

  public async mutateGame<T>(fn: (manager: BaseGameManager) => Promise<T> | T): Promise<T | undefined> {
    const prev = BaseGameManager.channelQueues.get(this.channelId) ?? Promise.resolve();
    const run = prev
      .catch(() => undefined)
      .then(async () => {
        const data = await this.repo.load(this.channelId);
        if (!data) return undefined;
        const modeId = data.mode;
        const ModeClass = modeId ? getGameMode(modeId) : undefined;
        if (!ModeClass) return undefined;
        const manager = new ModeClass(this.channelId);
        manager.repo = this.repo;
        manager.hydrate(data);
        return await fn(manager);
      });
    BaseGameManager.channelQueues.set(this.channelId, run);
    try {
      return await run;
    } finally {
      if (BaseGameManager.channelQueues.get(this.channelId) === run) {
        BaseGameManager.channelQueues.delete(this.channelId);
      }
    }
  }
}

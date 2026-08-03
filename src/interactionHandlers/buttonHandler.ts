import { ButtonInteraction, Events, GuildChannel, MessageFlags } from 'discord.js';
import { ClientWithExtendedTypes } from '../types/types';
import { BTN_IDS, MIN_PLAYER_IN_GAME } from '../types/globals';
import { BaseGameManager } from '../structures/BaseGameManager';
import { log } from '../utils/logger';
import { Player } from '../structures/PlayerManager';
import { announcementComponent } from '../components/announcementComponent';
import { autoDelete, safeDeferReply, safeEditReply, safeUpdate } from '../utils/interaction';

const buttonHandler = {
  name: Events.InteractionCreate,
  once: false,
  async execute(client: ClientWithExtendedTypes, interaction: ButtonInteraction) {
    const channel = interaction.channel as GuildChannel;
    if (!interaction.inGuild()) return;
    if (!channel) return;
    const user = interaction.user;

    if (interaction.customId.includes('placeholder')) {
      return await safeUpdate(interaction);
    }

    if (interaction.customId === BTN_IDS.VOTE_SKIP_BUTTON) {
      await safeDeferReply(interaction, { flags: MessageFlags.Ephemeral });

      const gmResult = await BaseGameManager.fromChannelId(channel.id);
      if (!gmResult.ok) {
        await safeEditReply(interaction, 'Something went wrong while fetching the game state');
        return;
      }
      const gm = gmResult.value;
      const res = await gm.mutateGame((manager) => manager.performAction(user.id, 'vote:skip'));

      if (!res || !res.ok) {
        const response = await safeEditReply(interaction, res?.error.message ?? 'An error occurred');
        log.error(res?.error, gm.state.toJSON());
        autoDelete(response);
        return;
      }

      const response = await safeEditReply(interaction, 'Your skip has been recorded');
      autoDelete(response);
      return;
    }

    if (interaction.customId === BTN_IDS.JOIN_LOBBY_BUTTON) {
      if (!interaction.member) return;
      if (interaction.user.bot) return;
      const member = interaction.member.user;
      const player = new Player(member.id, { username: member.username });

      await safeDeferReply(interaction, { flags: MessageFlags.Ephemeral });

      const gmResult = await BaseGameManager.fromChannelId(channel.id);

      if (!gmResult.ok) {
        log.error(gmResult.error);
        await safeEditReply(interaction, 'Something went wrong while fetching the game state');
        return;
      }

      const gm = gmResult.value;
      const result = await gm.mutateGame((manager) => manager.addPlayerToLobby(player));

      if (!result?.ok) {
        return await safeEditReply(interaction, result?.error.message ?? 'An error occurred');
      }

      return await safeEditReply(interaction, 'You have been added succesfully');
    }

    if (interaction.customId === BTN_IDS.LEAVE_LOBBY_BUTTON) {
      if (!interaction.member) return;
      if (interaction.user.bot) return;

      const member = interaction.member.user;

      await safeDeferReply(interaction, { flags: MessageFlags.Ephemeral });

      const gmResult = await BaseGameManager.fromChannelId(channel.id);

      if (!gmResult.ok) {
        log.error(gmResult.error);
        await safeEditReply(interaction, 'Something went wrong while fetching the game state');
        return;
      }

      const gm = gmResult.value;
      const result = await gm.mutateGame((manager) => manager.removePlayerFromLobby(manager.activePlayer(member.id)));

      if (!result?.ok) {
        return await safeEditReply(interaction, result?.error.message ?? 'An error occurred');
      }

      return await safeEditReply(interaction, 'You have been removed from the current lobby');
    }

    if (interaction.customId === BTN_IDS.COUNT_BUTTON) {
      await safeDeferReply(interaction, { flags: MessageFlags.Ephemeral });

      const gmResult = await BaseGameManager.fromChannelId(channel.id);

      if (!gmResult.ok) {
        log.error(gmResult.error);
        await safeEditReply(interaction, 'Something went wrong while fetching the game state');
        return;
      }
      const gm = gmResult.value;

      return await safeEditReply(interaction, `${gm.activePlayerCount()} person/s joined this lobby!`);
    }

    if (interaction.customId === BTN_IDS.START_LOBBY_GAME_BUTTON) {
      await safeDeferReply(interaction);

      const gmResult = await BaseGameManager.fromChannelId(channel.id);

      if (!gmResult.ok) {
        log.error(gmResult.error);
        await safeEditReply(interaction, 'Something went wrong while fetching the game state');
        return;
      }

      const gm = gmResult.value;
      const lobbyCreatorId = await gm.getLobbyCreator();

      if (gm.activePlayerCount() < MIN_PLAYER_IN_GAME) {
        return await safeEditReply(interaction, `Need at least ${MIN_PLAYER_IN_GAME} players to start!`);
      }

      if (interaction.user.id !== lobbyCreatorId) {
        return await safeEditReply(interaction, 'Only the lobby creator can start the game!');
      }

      await gm.requestGameStart();

      return await safeEditReply(interaction, {
        components: [announcementComponent({ messages: ['Game is about to start...'] })],
        flags: MessageFlags.IsComponentsV2,
      });
    }
  },
};

export default buttonHandler;

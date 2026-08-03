import { Events, GuildChannel, MessageFlags, StringSelectMenuInteraction } from 'discord.js';
import { BaseGameManager } from '../structures/BaseGameManager';
import { ClientWithExtendedTypes } from '../types/types';
import { log } from '../utils/logger';
import { MENU_IDS } from '../types/globals';
import { autoDelete, safeDeferReply, safeEditReply, safeUpdate } from '../utils/interaction';

const selectMenuInteraction = {
  name: Events.InteractionCreate,
  once: false,
  async execute(client: ClientWithExtendedTypes, interaction: StringSelectMenuInteraction) {
    const channel = interaction.channel as GuildChannel;
    if (!interaction.inGuild()) return;
    if (!channel) return;
    if (!interaction.isStringSelectMenu()) return;

    const user = interaction.user;
    const value = interaction.values.at(0);
    log.info([user, value]);
    if (!value) return;

    if (interaction.customId === MENU_IDS.SELECT_PERFORM_ACTION_MENU) {
      await safeDeferReply(interaction, { flags: MessageFlags.Ephemeral });

      const gameManagerResult = await BaseGameManager.fromChannelId(channel.id);
      if (!gameManagerResult.ok) {
        await safeEditReply(interaction, 'Something went wrong while fetching the game state');
        return;
      }
      const gameManager = gameManagerResult.value;

      const res = await gameManager.mutateGame((manager) => manager.performAction(user.id, value));

      if (!res || !res.ok) {
        const response = await safeEditReply(interaction, res?.error.message ?? 'An error occurred');
        autoDelete(response);
        return;
      }

      const response = await safeEditReply(
        interaction,
        'Action performed we would get to see the final result when the day wakes',
      );
      autoDelete(response);
      return;
    }

    if (interaction.customId === MENU_IDS.VOTE_USER_MENU) {
      await safeDeferReply(interaction, { flags: MessageFlags.Ephemeral });

      const gmResult = await BaseGameManager.fromChannelId(channel.id);
      if (!gmResult.ok) {
        await safeEditReply(interaction, 'Something went wrong while fetching the game state');
        return;
      }
      const gm = gmResult.value;

      if (user.id === value.split(':')[1]) {
        const response = await safeEditReply(interaction, 'You can not vote out yourself silly.');
        autoDelete(response);
        return;
      }

      const res = await gm.mutateGame((manager) => manager.performAction(user.id, value));

      if (!res || !res.ok) {
        const response = await safeEditReply(interaction, res?.error.message ?? 'An error occurred');
        autoDelete(response);
        return;
      }

      const response = await safeEditReply(interaction, 'Your vote has been recorded');
      autoDelete(response);
      return;
    }

    return await safeUpdate(interaction);
  },
};

export default selectMenuInteraction;

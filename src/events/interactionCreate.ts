import { CommandInteraction, Events, GuildChannel, MessageFlags } from 'discord.js';
import { ClientWithExtendedTypes } from '../types/types';
import { checkGuildAndChannelPermissions } from '../utils/permissions';
import selectMenuInteraction from '../interactionHandlers/selectUserMenuInteraction';
import buttonHandler from '../interactionHandlers/buttonHandler';
import { safeReply } from '../utils/interaction';

const commandInteraction = {
  name: Events.InteractionCreate,
  once: false,
  async execute(client: ClientWithExtendedTypes, interaction: CommandInteraction) {
    const channel = interaction.channel;

    if (!interaction.inGuild()) return; // for now i want to ignore non-guild interactions

    if (!interaction.channel?.isTextBased()) {
      return await safeReply(
        interaction,
        'Sorry, for now, this bot can only be used in channels that support text based messages',
      );
    }

    const sendMessageToUser = async (msg: string) => {
      const dm = await interaction.user.createDM();
      if (!dm.isSendable()) return;
      return await dm.send(msg);
    };

    if (!channel?.isSendable()) {
      await safeReply(interaction, {
        content: 'An error occurred please check your dm or make sure to enable it.',
        flags: MessageFlags.Ephemeral,
      });
      return await sendMessageToUser(
        'A permission error occurred while trying to send a message in that channel. Please could you verify if I have the required access to it? If this persists, please do reach out to my creators.',
      );
    }

    const isGuildPermissionsOk = await checkGuildAndChannelPermissions(channel as GuildChannel, client);

    if (!isGuildPermissionsOk.ok && interaction.commandName !== 'permissions') {
      return await sendMessageToUser(isGuildPermissionsOk.error.message);
    }

    if (interaction.isStringSelectMenu()) {
      return await selectMenuInteraction.execute(client, interaction);
    }

    if (interaction.isButton()) {
      return await buttonHandler.execute(client, interaction);
    }

    const command = client.interactionCommands.get(interaction.commandName);
    if (command) {
      return await command.execute(client, interaction);
    }
  },
};

export default commandInteraction;

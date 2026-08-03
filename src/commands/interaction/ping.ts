import { CommandInteraction, SlashCommandBuilder } from 'discord.js';
import { ClientWithExtendedTypes } from '../../types/types';
import { safeReply } from '../../utils/interaction';

const pingCommand = new SlashCommandBuilder().setName('ping').setDescription('Ping the bot');

const command = {
  name: pingCommand.name,
  description: pingCommand.description,
  data: pingCommand,
  cooldown: 0,
  async execute(client: ClientWithExtendedTypes, interaction: CommandInteraction) {
    if (!interaction.inGuild()) return;

    const currentTime = Date.now();

    await safeReply(interaction, `Pong! response took: ${Date.now() - currentTime} ms, ws: ${client.ws.ping} ms`);
  },
};

export default command;

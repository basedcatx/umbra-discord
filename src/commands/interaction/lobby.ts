import { ChatInputCommandInteraction, GuildTextBasedChannel, SlashCommandBuilder } from 'discord.js';

import { ClientWithExtendedTypes, SlashCommandType } from '../../types/types';
import { BaseGameManager } from '../../structures/BaseGameManager';
import { ClassicWerewolfGame } from '../../structures/gameModes/ClassicWerewolfGame';
import { registerGameMode } from '../../structures/gameModes/registry';
import { log } from '../../utils/logger';
import { safeDeferReply, safeEditReply } from '../../utils/interaction';

// register all game modes here.
registerGameMode('classic', ClassicWerewolfGame, { isDefault: true });

const createLobbyCommand = new SlashCommandBuilder()
  .setName('createlobby')
  .setDescription('Creates a game lobby in the channel this command was ran in.')
  .addStringOption((option) =>
    option
      .setName('mode')
      .setDescription('Which game mode do you want to play?')
      .addChoices({ name: 'Classic Werewolf', value: 'classic' }),
  );

const command: SlashCommandType = {
  ...createLobbyCommand.toJSON(),
  cooldown: 0,
  async execute(client: ClientWithExtendedTypes, interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.inGuild()) return;

    const channel = interaction.channel as GuildTextBasedChannel;
    const mode = interaction.options.get('mode')?.value?.toString() ?? 'classic';

    await safeDeferReply(interaction);

    let gameManager: BaseGameManager;
    const existingGameResult = await BaseGameManager.fromChannelId(channel.id, mode);

    if (!existingGameResult.ok) {
      log.error(existingGameResult.error);
      await safeEditReply(interaction, 'An error occurred while creating the game');
      return;
    }

    gameManager = existingGameResult.value;

    const lobbyResult = await gameManager.createLobby();
    if (!lobbyResult.ok) {
      await safeEditReply(interaction, lobbyResult.error.message);
      return;
    }

    await gameManager.setLobbyCreator(interaction.user.id);
    await gameManager.startLobby(interaction);
  },
};

export default command;

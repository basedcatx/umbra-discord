import { CommandInteraction, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { ClientWithExtendedTypes } from '../../types/types';
import { BaseGameManager } from '../../structures/BaseGameManager';
import { Player } from '../../structures/PlayerManager';
import { GamePhase, LifeStatus } from '../../types/states';
import { Phases, PlayerActions, PlayerRoles } from '../../structures/gameModes/classic';
import { log } from '../../utils/logger';
import { safeDeferReply, safeEditReply } from '../../utils/interaction';

const testGameCommand = new SlashCommandBuilder()
  .setName('testgame')
  .setDescription('Test the game with')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

const command = {
  name: testGameCommand.name,
  description: testGameCommand.description,
  data: testGameCommand,
  cooldown: 0,

  async execute(client: ClientWithExtendedTypes, interaction: CommandInteraction) {
    if (!interaction.inGuild()) return;
    if (!interaction.channel) return;

    await safeDeferReply(interaction);

    const gameManagerResult = await BaseGameManager.fromChannelId(interaction.channel.id);
    if (!gameManagerResult.ok) {
      return await safeEditReply(interaction, 'No game found in this channel');
    }
    const gameManager = gameManagerResult.value;

    if (gameManager.getSubPhase() === Phases.NIGHT) {
      await gameManager.mutateGame(async (manager) => {
        const alive = manager.activePlayers().filter((p) => p.lifeStatus === LifeStatus.ALIVE);
        const bots = alive.filter((p) => p.isBot);

        await Promise.all(
          bots.map((bot) => {
            const action =
              bot.role === PlayerRoles.DOCTOR
                ? PlayerActions[PlayerRoles.DOCTOR].SAVE
                : bot.role === PlayerRoles.IMPOSTER
                  ? PlayerActions[PlayerRoles.IMPOSTER].KILL
                  : PlayerActions[PlayerRoles.TOWNIE].WORK;

            const targets = alive.filter((p) => {
              if (p.id === bot.id) return false;
              if (bot.role === PlayerRoles.IMPOSTER && p.role === PlayerRoles.IMPOSTER) return false;
              return true;
            });
            if (targets.length === 0) return Promise.resolve();

            const target = targets[Math.floor(Math.random() * targets.length)];
            return manager.performAction(bot.id, `${action}:${target.id}:`);
          }),
        );

        await manager.save();
      });
      return await safeEditReply(interaction, 'Each bot just did a role-appropriate action');
    }

    if (gameManager.getPhase() !== GamePhase.IN_LOBBY) {
      log.error('Game is not in lobby state');
      return await safeEditReply(interaction, 'Game is not in lobby state');
    }

    for (let i = 0; i < 20; i++) {
      const player = new Player(`${i}`, { isBot: true });
      await gameManager.mutateGame((manager) => manager.addPlayerToLobby(player));
    }

    await safeEditReply(interaction, "Bot's succesfully spawned");
  },
};

export default command;

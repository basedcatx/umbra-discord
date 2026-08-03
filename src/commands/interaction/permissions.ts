import {
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  ContainerBuilder,
  GuildChannel,
  MessageFlags,
  SeparatorSpacingSize,
  SlashCommandBuilder,
  bold,
} from 'discord.js';
import { ClientWithExtendedTypes, SlashCommandType } from '../../types/types';
import { channelPermissionsState } from '../../utils/permissions';
import { safeReply } from '../../utils/interaction';
import { ASSETS } from '../../utils/asset_utils';

const permissionsCommand = new SlashCommandBuilder()
  .setName('permissions')
  .setDescription('Shows what permissions I need in this channel and whether they are granted.');

const command: SlashCommandType = {
  ...permissionsCommand.toJSON(),
  cooldown: 0,
  async execute(client: ClientWithExtendedTypes, interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.inGuild()) return;

    const channel = interaction.channel as GuildChannel;
    const states = channelPermissionsState(channel, client);

    const container = new ContainerBuilder()
      .addMediaGalleryComponents((m) => m.addItems((a) => a.setURL(ASSETS.PERMISSIONS_URL)))
      .addSeparatorComponents((s) => s.setDivider(false));

    let temp = 0;
    for (const state of states) {
      container
        .addSectionComponents((section) =>
          section
            .addTextDisplayComponents((td) => td.setContent(`${bold(state.label)}\n${state.why}`))
            .setButtonAccessory(
              new ButtonBuilder()
                .setCustomId(`permissions-status:placeholder:${String(temp++)}`)
                .setStyle(state.granted ? ButtonStyle.Success : ButtonStyle.Danger)
                .setLabel(state.granted ? 'Granted' : 'Missing'),
            ),
        )
        .addSeparatorComponents((s) => s.setDivider(false).setSpacing(SeparatorSpacingSize.Large));
    }

    await safeReply(interaction, {
      components: [container],
      flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral],
    });
  },
};

export default command;

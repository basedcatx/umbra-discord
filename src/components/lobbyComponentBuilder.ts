import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, heading, SeparatorSpacingSize } from 'discord.js';
import { BTN_IDS } from '../types/globals';
import { ASSETS } from '../utils/asset_utils';
import { timerButtonComponent } from './timerButtonComponent';

export function lobbyComponentBuilder({
  timeRemaining,
  header,
  body,
  joined,
}: {
  readonly timeRemaining: number;
  readonly header: string;
  readonly body: string;
  readonly joined: number;
}) {
  return [
    new ContainerBuilder()
      .addMediaGalleryComponents((m) => m.addItems((a) => a.setURL(ASSETS.LOBBY_URL)))
      .addSeparatorComponents((s) => s.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
      .addTextDisplayComponents((td) => td.setContent(heading(`${header}`, 2)))
      .addSeparatorComponents((s) => s.setDivider(false).setSpacing(SeparatorSpacingSize.Large))
      .addSectionComponents((s) =>
        s
          .addTextDisplayComponents((td) => td.setContent(body))
          .setButtonAccessory(timerButtonComponent(timeRemaining, true)),
      ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setStyle(ButtonStyle.Secondary)
        .setCustomId(BTN_IDS.START_LOBBY_GAME_BUTTON)
        .setLabel(`Start game (only by the lobby's creator)`),
    ),
    new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setStyle(ButtonStyle.Secondary)
          .setCustomId(BTN_IDS.LEAVE_LOBBY_BUTTON)
          .setLabel(`Leave lobby`),
      )
      .addComponents(
        new ButtonBuilder()
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true)
          .setCustomId('placeholder3')
          .setLabel(`${joined} ${joined > 1 ? 'Players' : 'Player'} joined`),
      )
      .addComponents(
        new ButtonBuilder().setStyle(ButtonStyle.Secondary).setCustomId(BTN_IDS.JOIN_LOBBY_BUTTON).setLabel(`Join lobby`),
      ),
  ];
}

import { bold, ButtonBuilder, ButtonStyle, ContainerBuilder, heading, italic, userMention } from 'discord.js';
import { BTN_IDS } from '../types/globals';
import { Player } from '../structures/PlayerManager';
import { SeparatorSpacingSize } from 'discord.js';
import { GameCurrentEvent, GameInfoConstants } from '../constants/GameInfo';

export function assignRolesComponent({ players, mode }: { players: Player[]; mode: GameInfoConstants }) {
  const mentionPlayers = () =>
    players.reduce((acc: string[], player: Player) => {
      acc.push(userMention(player.id));
      return acc;
    }, []);

  return new ContainerBuilder()
    .addTextDisplayComponents((td) => td.setContent(heading(GameCurrentEvent.headline)))
    .addTextDisplayComponents((td) => td.setContent(italic(GameCurrentEvent.msg)))
    .addSeparatorComponents((s) => s.setDivider(false))
    .addTextDisplayComponents((td) => td.setContent(mode.desc))
    .addTextDisplayComponents((td) => td.setContent(italic('~ Dun')))
    .addSeparatorComponents((s) => s.setDivider(true))
    .addTextDisplayComponents((td) => td.setContent(bold('Active players')))
    .addSeparatorComponents((s) => s.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents((td) => td.setContent(mentionPlayers().join(' | ')))
    .addSeparatorComponents((s) => s.setDivider(true))
    .addSectionComponents((section) =>
      section
        .addTextDisplayComponents((td) =>
          td.setContent(
            'Click on the button below to check your role, you would be considered inactive (and booted out of this lobby) if you do not',
          ),
        )
        .setButtonAccessory(
          new ButtonBuilder().setCustomId(BTN_IDS.ASSIGN_ROLE_BTN).setLabel('Reveal').setStyle(ButtonStyle.Danger),
        ),
    );
}

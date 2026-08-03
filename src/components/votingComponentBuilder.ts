import { ButtonBuilder, ButtonStyle, Colors, ContainerBuilder, SeparatorSpacingSize } from 'discord.js';
import { Player } from '../structures/PlayerManager';
import { timerButtonComponent } from './timerButtonComponent';
import { BTN_IDS, MENU_IDS } from '../types/globals';
import { selectUserMenu } from './selectUserMenu';

export function votingComponentBuilder({ players, timer }: { players: Player[]; timer: number }) {
  return new ContainerBuilder()
    .addTextDisplayComponents((td) => td.setContent('Voting'))
    .addSectionComponents((section) =>
      section
        .addTextDisplayComponents((td) => td.setContent('Select a player to eliminate. Choose wisely!'))
        .setButtonAccessory(timerButtonComponent(timer)),
    )
    .addSeparatorComponents((s) => s.setDivider(false))
    .addActionRowComponents((b) => b.addComponents(selectUserMenu(players, undefined, MENU_IDS.VOTE_USER_MENU, 'vote')))
    .addSeparatorComponents((s) => s.setSpacing(SeparatorSpacingSize.Large).setDivider(false))
    .addActionRowComponents((c) =>
      c.addComponents(
        new ButtonBuilder().setCustomId(BTN_IDS.VOTE_SKIP_BUTTON).setLabel('Skip Vote').setStyle(ButtonStyle.Danger),
      ),
    );
}

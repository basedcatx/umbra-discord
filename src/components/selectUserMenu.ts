import { ContainerBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import { MENU_IDS } from '../types/globals';
import { LifeStatus } from '../types/states';
import { Player } from '../structures/PlayerManager';
import { PlayerActions, PlayerRoles } from '../structures/gameModes/classic';

export function selectUserMenu(
  players: Player[],
  currPlayer: Player | undefined,
  customId: MENU_IDS,
  action: string,
  args: string[] = [],
) {
  return new StringSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder('Select your target user')
    .addOptions(
      ...players
        .filter((p) => p.lifeStatus === LifeStatus.ALIVE && (!currPlayer || p.id !== currPlayer.id))
        .map((p) =>
          new StringSelectMenuOptionBuilder().setLabel(p.username).setValue(`${action}:${p.id}:${args.join(':')}`),
        ),
    );
}

// I would leave it at this for now... with time I would know some better way to do this.
export function selectPerformActionUserMenu(players: Player[], currPlayer: Player) {
  return new ContainerBuilder()
    .addTextDisplayComponents((textDisplay) => {
      switch (currPlayer.role) {
        case PlayerRoles.DOCTOR:
          return textDisplay.setContent('The streets are dangerous. Who will you keep safe?');
        case PlayerRoles.IMPOSTER:
          return textDisplay.setContent('Who is the target tonight? Choose wisely, partner.');
        default:
          return textDisplay.setContent('Mahaha');
      }
    })
    .addActionRowComponents((actionRow) =>
      actionRow.setComponents(
        selectUserMenu(
          players,
          currPlayer,
          MENU_IDS.SELECT_PERFORM_ACTION_MENU,
          currPlayer.role === PlayerRoles.DOCTOR
            ? PlayerActions[PlayerRoles.DOCTOR].SAVE
            : PlayerActions[PlayerRoles.IMPOSTER].KILL,
        ),
      ),
    );
}

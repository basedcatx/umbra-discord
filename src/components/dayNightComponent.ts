import {
  bold,
  ButtonBuilder,
  ButtonStyle,
  Colors,
  ContainerBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
  userMention,
} from 'discord.js';
import { LifeStatus } from '../types/states';
import { BTN_IDS } from '../types/globals';
import { timerButtonComponent } from './timerButtonComponent';
import { Player } from '../structures/PlayerManager';
import { ASSETS } from '../utils/asset_utils';
import { Phases, PlayerRoles } from '../structures/gameModes/classic';

export function dayNightComponent({
  phase,
  players,
  timer,
  round: _round,
}: {
  phase: string;
  players: Player[];
  timer?: number;
  round?: number;
}) {
  // I don't think think these should be disabled buttons. Maybe they should serve as a way to get more details at any time ingame.
  if (phase === Phases.NIGHT) {
    return new ContainerBuilder()
      .setAccentColor(4288492)
      .addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(ASSETS.SUNSET_URL)))
      .addTextDisplayComponents(new TextDisplayBuilder().setContent('The Night Falls'))
      .addSectionComponents((section) =>
        section
          .setButtonAccessory(timerButtonComponent(timer))
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "Only the most brave and fearless ones are out in the streets. We'll try to count the fallen ones in the morning...",
            ),
          ),
      )
      .addSeparatorComponents((s) => s.setDivider(false))
      .addActionRowComponents((builder) =>
        builder.addComponents(
          new ButtonBuilder()
            .setLabel('Perform an action')
            .setStyle(ButtonStyle.Secondary)
            .setCustomId(BTN_IDS.PERFORM_ACTION_BTN),
        ),
      );
  }

  const alive = players.filter((p) => p.lifeStatus === LifeStatus.ALIVE);
  const dead = players.filter((p) => p.lifeStatus === LifeStatus.DEAD);

  const aliveMentions = alive.map((p) => userMention(p.id)).join(' | ') || 'NONE';
  const deadMentions = dead.map((p) => p.username).join(' | ') || 'NONE';

  const aliveImposters = alive.filter((p) => p.role === PlayerRoles.IMPOSTER).length;
  const aliveDoctors = alive.filter((p) => p.role === PlayerRoles.DOCTOR).length;

  const container = new ContainerBuilder()
    .setAccentColor(Colors.DarkRed)
    .addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(ASSETS.SUNRISE_URL)))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('The Day begins'))
    .addSectionComponents((section) =>
      section
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent('The sun rises and dries the blood spilled on the asphalt last night...'),
        )
        .setButtonAccessory(timerButtonComponent(timer)),
    )
    .addSeparatorComponents((s) => s.setDivider(false).setSpacing(SeparatorSpacingSize.Large))
    .addTextDisplayComponents((td) =>
      td.setContent(
        bold(
          'You can discuss about the previous night, or randomly chat and get to know possible subjects before the night approaches',
        ),
      ),
    )
    .addSeparatorComponents((s) => s.setDivider(false).setSpacing(SeparatorSpacingSize.Large))
    .addTextDisplayComponents((td) => td.setContent(bold('Alive')))
    .addTextDisplayComponents((td) => td.setContent(aliveMentions));

  if (dead.length > 0) {
    container
      .addSeparatorComponents((s) => s.setSpacing(SeparatorSpacingSize.Small).setDivider(false))
      .addTextDisplayComponents((td) => td.setContent(bold('Dead')))
      .addTextDisplayComponents((td) => td.setContent(deadMentions));
  }

  container
    .addSeparatorComponents((s) => s.setDivider(false).setSpacing(SeparatorSpacingSize.Large))
    .addActionRowComponents((row) =>
      row
        .addComponents(
          new ButtonBuilder()
            .setCustomId('placeholder0')
            .setStyle(ButtonStyle.Secondary)
            .setLabel(`Alive players: ${alive.length.toString()}`),
        )
        .addComponents(
          new ButtonBuilder()
            .setCustomId('placeholder1')
            .setStyle(ButtonStyle.Secondary)
            .setLabel(`Dead players: ${dead.length.toString()}`),
        )
        .addComponents(
          new ButtonBuilder()
            .setCustomId('placeholder3')
            .setStyle(ButtonStyle.Secondary)
            .setLabel(`Imposters: ${aliveImposters.toString()}`),
        )
        .addComponents(
          new ButtonBuilder()
            .setCustomId('placeholder4')
            .setStyle(ButtonStyle.Secondary)
            .setLabel(`Doctors: ${aliveDoctors.toString()}`),
        ),
    )
    .addSeparatorComponents((s) => s.setDivider(false).setSpacing(SeparatorSpacingSize.Large))
    .addSectionComponents((row) =>
      row
        .setButtonAccessory(
          new ButtonBuilder()
            .setCustomId('placeholder2')
            .setStyle(ButtonStyle.Secondary)
            .setLabel(`Day: ${(_round ?? 1).toString()}`),
        )
        .addTextDisplayComponents((td) => td.setContent('Ensure you make it to the next day')),
    );

  return container;
}

import { Colors, ContainerBuilder, inlineCode } from 'discord.js';

export function checkGameDetailsComponent({ phase, round, role }: { phase: string; round: number; role: string }) {
  return new ContainerBuilder()
    .setAccentColor(Colors.LightGrey)
    .addTextDisplayComponents((td) =>
      td.setContent(
        `Role: ${inlineCode(role.toString())}\nPhase: ${inlineCode(phase)}\nRound: ${inlineCode(round.toString())}`,
      ),
    );
}

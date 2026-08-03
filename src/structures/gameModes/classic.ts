// Shared definitions for the classic werewolf game mode.
//
// Lives outside ClassicWerewolfGame so components and handlers can reference
// roles/phases without importing the whole game class (which would be circular).

export const PlayerRoles = {
  DOCTOR: 'doctor',
  IMPOSTER: 'imposter',
  TOWNIE: 'townie',
} as const;

export type PlayerRole = (typeof PlayerRoles)[keyof typeof PlayerRoles];

export const PlayerActions = {
  [PlayerRoles.DOCTOR]: { SAVE: 'save' },
  [PlayerRoles.IMPOSTER]: { KILL: 'kill' },
  [PlayerRoles.TOWNIE]: { WORK: 'work' },
  VOTE: 'vote',
} as const;

export enum Phases {
  DAY = 'day',
  NIGHT = 'night',
  VOTING = 'voting',
}

export function classicPlayerLabelFormatter(imposters: number, othersCount: number): string {
  return `${imposters} Imposters & ${othersCount} Others`;
}

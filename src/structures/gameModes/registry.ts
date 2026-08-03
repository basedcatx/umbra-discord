import type { BaseGameManager } from '../BaseGameManager';

export type GameModeClass = new (channelId: string) => BaseGameManager;

const gameModeRegistry = new Map<string, GameModeClass>();

let defaultGameModeId = '';

export function registerGameMode(
  modeId: string,
  modeClass: GameModeClass,
  { isDefault = false }: { isDefault?: boolean } = {},
): void {
  gameModeRegistry.set(modeId, modeClass);
  if (isDefault) defaultGameModeId = modeId;
}

export function getGameMode(modeId: string): GameModeClass | undefined {
  return gameModeRegistry.get(modeId) ?? gameModeRegistry.get(defaultGameModeId);
}

export function getDefaultGameModeId(): string {
  return defaultGameModeId || (gameModeRegistry.keys().next().value ?? '');
}

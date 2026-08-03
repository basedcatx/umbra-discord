import { GuildTextBasedChannel } from 'discord.js';
import type { GameState } from '../structures/GameState';
import type { Player } from '../structures/PlayerManager';
import type { GamePhase } from './states';
import type { RBoolean } from './types';

export interface PhaseDefinition {
  id: string;
  duration: number;
  run?(manager: GameManagerContract, channel: GuildTextBasedChannel): Promise<void>;
  resolve?(manager: GameManagerContract, channel: GuildTextBasedChannel): Promise<void>;
}

export interface GameManagerContract {
  readonly channelId: string;
  readonly state: GameState;

  gameModeId: string;
  minPlayers: number;
  maxPlayers: number;
  phaseSequence(): PhaseDefinition[];
  winCondition(): boolean;
  onGameStart(channel: GuildTextBasedChannel): Promise<void>;
  onGameEnd(channel: GuildTextBasedChannel): Promise<void>;
  performAction(playerId: string, value: string): Promise<RBoolean>;

  // [0] action, [1] is target player id [2] others if applicable.
  _handlePerformAction(_playerId: string, args: string[]): Promise<RBoolean>;
  getPhase(): GamePhase;
  activePlayers(): Player[];
  activePlayer(id: string): Player | undefined;
  activePlayerCount(): number;
  save(): Promise<void>;
  reload(): Promise<boolean>;
  reset(): Promise<void>;
}

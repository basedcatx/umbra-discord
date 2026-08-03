import { Collection, Snowflake } from 'discord.js';
import { GamePhase, LifeStatus } from '../types/states';
import { Player, PlayerInterface } from './PlayerManager';

export const GameFlags = {
  IsInactive: 1 << 0,
} as const;

export interface GameStateInterface {
  _phase: GamePhase;
  _round: number;
  _activePlayers: [string, PlayerInterface][] | Collection<string, Player>;
  _flags: number;
}

export class GameState {
  _phase: GamePhase = GamePhase.NONE;
  _round = 1;
  _activePlayers = new Collection<Snowflake, Player>();
  _flags: number = 0;

  static fromJSON(obj: GameStateInterface): GameState {
    const state = new GameState();
    state._phase = obj._phase;
    state._round = obj._round;
    state._activePlayers = new Collection(
      (obj._activePlayers as [string, PlayerInterface][]).map(([id, p]) => [id, Player.fromJSON(p)]),
    );
    state._flags = obj._flags;
    return state;
  }

  public toJSON(): GameStateInterface {
    const serializedPlayers: [string, PlayerInterface][] = [];

    this._activePlayers.map((p, id) => serializedPlayers.push([id, p.toJSON()]));

    return {
      _phase: this._phase,
      _round: this._round,
      _activePlayers: serializedPlayers,
      _flags: this._flags,
    };
  }

  public addPlayer(player: Player): boolean {
    if (this._activePlayers.has(player.id)) return false;
    this._activePlayers.set(player.id, player);
    return true;
  }

  public removePlayer(playerId: string): boolean {
    return this._activePlayers.delete(playerId);
  }

  public setPlayers(players: Player[]): void {
    this._activePlayers.clear();
    players.forEach((p) => this._activePlayers.set(p.id, p));
  }

  public setPlayer(id: string, p: Player): void {
    this._activePlayers.set(id, p);
  }

  public getPlayer(playerId: string): Player | undefined {
    return this._activePlayers.get(playerId);
  }

  public getPlayers(): Player[] {
    return Array.from(this._activePlayers.values());
  }

  public getAlivePlayers(): Player[] {
    return this.getPlayers().filter((p) => p.lifeStatus === LifeStatus.ALIVE);
  }

  public get playerCount(): number {
    return this._activePlayers.size;
  }
}

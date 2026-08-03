import { describe, test, expect } from 'bun:test';
import { GameState, GameFlags } from '../structures/GameState';
import { Player } from '../structures/PlayerManager';
import { GamePhase, LifeStatus } from '../types/states';

describe('GameState registers', () => {
  test('addPlayer adds a player and rejects duplicates', () => {
    const state = new GameState();
    const player = new Player('1', { username: 'alice' });
    expect(state.addPlayer(player)).toBe(true);
    expect(state.playerCount).toBe(1);
    expect(state.addPlayer(player)).toBe(false);
    expect(state.playerCount).toBe(1);
  });

  test('removePlayer removes by id', () => {
    const state = new GameState();
    state.addPlayer(new Player('1', { username: 'alice' }));
    state.addPlayer(new Player('2', { username: 'bob' }));
    expect(state.removePlayer('1')).toBe(true);
    expect(state.removePlayer('missing')).toBe(false);
    expect(state.playerCount).toBe(1);
  });

  test('setPlayers replaces the full roster', () => {
    const state = new GameState();
    state.addPlayer(new Player('1', { username: 'alice' }));
    state.setPlayers([new Player('2', { username: 'bob' }), new Player('3', { username: 'carol' })]);
    expect(state.playerCount).toBe(2);
    expect(state.getPlayer('1')).toBeUndefined();
  });

  test('getAlivePlayers filters out dead players', () => {
    const state = new GameState();
    const alive = new Player('1', { username: 'alice' });
    const dead = new Player('2', { username: 'bob' });
    dead.lifeStatus = LifeStatus.DEAD;
    state.addPlayer(alive);
    state.addPlayer(dead);
    expect(state.getAlivePlayers().map((p) => p.id)).toEqual(['1']);
  });

  test('toJSON/fromJSON round-trips the full state', () => {
    const state = new GameState();
    state._phase = GamePhase.IN_GAME;
    state._round = 3;
    state._flags = GameFlags.IsInactive;
    const player = new Player('1', { username: 'alice' });
    state.addPlayer(player);

    const restored = GameState.fromJSON(JSON.parse(JSON.stringify(state.toJSON())));

    expect(restored._phase).toBe(GamePhase.IN_GAME);
    expect(restored._round).toBe(3);
    expect(restored._flags).toBe(GameFlags.IsInactive);
    expect(restored.playerCount).toBe(1);
    expect(restored.getPlayer('1')?.username).toBe('alice');
  });

  test('fresh GameState starts in NONE phase with zero flags', () => {
    const state = new GameState();
    expect(state._phase).toBe(GamePhase.NONE);
    expect(state._round).toBe(1);
    expect(state._flags).toBe(0);
    expect(state.playerCount).toBe(0);
  });
});

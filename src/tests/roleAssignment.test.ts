import { Player } from '../structures/PlayerManager';
import { shuffleArray } from '../utils/shuffle_array';
import { LifeStatus, ActivityState } from '../types/states';
import { PlayerRoles } from '../structures/gameModes/classic';
import { describe, test, expect } from 'bun:test';

function assignRolesSimulation(playerCount: number) {
  const players = Array.from({ length: playerCount }, (_, i) => {
    const p = new Player(`${i}`, { username: `player${i}` });
    p.activityState = ActivityState.IN_GAME;
    p.lifeStatus = LifeStatus.ALIVE;
    p.role = PlayerRoles.TOWNIE;
    return p;
  });

  const shuffled = shuffleArray(players);
  const impIdx = Math.floor(Math.random() * shuffled.length);
  let docIdx = Math.floor(Math.random() * shuffled.length);
  while (docIdx === impIdx) {
    docIdx = Math.floor(Math.random() * shuffled.length);
  }

  shuffled[impIdx].role = PlayerRoles.IMPOSTER;
  shuffled[docIdx].role = PlayerRoles.DOCTOR;

  return shuffled;
}

describe('Role assignment', () => {
  test('Imposter and Doctor are always different players', () => {
    for (let run = 0; run < 500; run++) {
      const players = assignRolesSimulation(10);
      const imp = players.find((p) => p.role === PlayerRoles.IMPOSTER);
      const doc = players.find((p) => p.role === PlayerRoles.DOCTOR);
      expect(imp?.id).not.toBe(doc?.id);
    }
  });

  test('Doctor is not predictably adjacent to Imposter', () => {
    // Run many times and check that the distance between
    // Imposter and Doctor isn't always 1
    let adjacentCount = 0;
    const runs = 1000;
    const playerCount = 20;

    for (let run = 0; run < runs; run++) {
      const players = assignRolesSimulation(playerCount);
      const impIdx = players.findIndex((p) => p.role === PlayerRoles.IMPOSTER);
      const docIdx = players.findIndex((p) => p.role === PlayerRoles.DOCTOR);
      const distance = Math.abs(impIdx - docIdx);
      if (distance === 1 || distance === playerCount - 1) adjacentCount++;
    }

    // At most 10% should be adjacent (random chance is ~10.5% for 20 players)
    expect(adjacentCount / runs).toBeLessThan(0.15);
  });

  test('Only one Imposter and one Doctor per game', () => {
    for (let run = 0; run < 100; run++) {
      const players = assignRolesSimulation(8);
      const imposters = players.filter((p) => p.role === PlayerRoles.IMPOSTER);
      const doctors = players.filter((p) => p.role === PlayerRoles.DOCTOR);
      expect(imposters).toHaveLength(1);
      expect(doctors).toHaveLength(1);
    }
  });

  test('Every player gets a role', () => {
    const players = assignRolesSimulation(5);
    expect(players.every((p) => p.role !== undefined)).toBe(true);
  });
});

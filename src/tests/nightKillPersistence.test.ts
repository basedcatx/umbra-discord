import { describe, test, expect } from 'bun:test';
import { CommandInteraction, GuildTextBasedChannel, Message } from 'discord.js';
import { BaseGameManager, setDefaultGameRepository } from '../structures/BaseGameManager';
import { GameStateRepository, RedisLike, gameStateRepository } from '../storage/gameStateRepository';
import { registerGameMode } from '../structures/gameModes/registry';
import { Player, PlayerFlags } from '../structures/PlayerManager';
import { LifeStatus } from '../types/states';
import type { PhaseDefinition } from '../types/gameModes';
import { RBoolean } from '../types/types';

const CHANNEL_ID = 'chan-night-kill-test';

function createFakeStore() {
  const data = new Map<string, string | Record<string, string>>();
  const store: RedisLike = {
    async exists(key) {
      return data.has(key);
    },
    async hgetall(key) {
      const value = data.get(key);
      return typeof value === 'object' ? { ...(value as Record<string, string>) } : {};
    },
    async hset(key, fields) {
      const prev = data.get(key);
      const hash = typeof prev === 'object' ? { ...(prev as Record<string, string>) } : {};
      Object.assign(hash, fields);
      data.set(key, hash);
      return Object.keys(fields).length;
    },
    async del(...keys) {
      let count = 0;
      for (const key of keys) if (data.delete(key)) count++;
      return count;
    },
    async set(key, value, ...options) {
      if (options.includes('NX') && data.has(key)) return null;
      data.set(key, value);
      return 'OK';
    },
    async get(key) {
      const value = data.get(key);
      return typeof value === 'string' ? value : null;
    },
    async expire() {
      return 1;
    },
  };
  return { repo: new GameStateRepository(store), data };
}

const fakeChannel = { id: CHANNEL_ID, send: async () => ({}) } as unknown as GuildTextBasedChannel;
const fakeInteraction = { channel: fakeChannel } as unknown as CommandInteraction;

// A stub that mimics the classic night cycle: players flagged WasKilled become DEAD
// during the resolve step. It mirrors resolveNightPhase's mutation-on-`this.state`
// behavior.
class NightResolveStub extends BaseGameManager {
  gameModeId = 'stub-night-resolve';
  minPlayers = 1;
  maxPlayers = 10;

  async _handlePerformAction(_playerId: string, args: string[]): Promise<RBoolean> {
    return { ok: true };
  }

  async handleInGameMessage(_msg: Message): Promise<void> {}

  phaseSequence(): PhaseDefinition[] {
    return [
      {
        id: 'night',
        duration: 1,
        resolve: async (m) => {
          for (const p of m.state.getPlayers()) {
            if (p.has(PlayerFlags.WasKilled)) p.lifeStatus = LifeStatus.DEAD;
          }
        },
      },
    ];
  }

  winCondition(): boolean {
    return this.state.getPlayers().some((p) => p.lifeStatus === LifeStatus.DEAD);
  }

  async onGameStart(): Promise<void> {}

  async onGameEnd(): Promise<void> {}
}

registerGameMode('stub-night-resolve', NightResolveStub);

describe('night resolve persistence', () => {
  test('a kill flagged before the resolve survives the resolve and ends the game', async () => {
    const { repo } = createFakeStore();
    setDefaultGameRepository(repo);
    try {
      const manager = new NightResolveStub(CHANNEL_ID, repo);
      await manager.createLobby();
      await manager.addPlayerToLobby(new Player('p1', { username: 'imposter' }));
      await manager.addPlayerToLobby(new Player('p2', { username: 'townie' }));

      // Persist the night's kill (what a performAction would leave behind).
      const seeded = await manager.mutateGame(async (m) => {
        m.state.getPlayer('p2')!.setFlag(PlayerFlags.WasKilled);
        await m.save();
      });
      expect(seeded).toBeUndefined();

      // Regression: if the resolve ran on a stale manager and the loop re-saved
      // stale state (the old `mutateGame((m) => m.save())` bug), the kill would be
      // silently discarded, winCondition would stay false forever, and the loop
      // would never end.
      const res = await manager.startGame(fakeInteraction);
      expect(res.ok).toBe(true);
    } finally {
      setDefaultGameRepository(gameStateRepository);
    }
  });

  test('an untouched player is not killed by the resolve', async () => {
    const { repo } = createFakeStore();
    const manager = new NightResolveStub(CHANNEL_ID, repo);
    await manager.createLobby();
    await manager.addPlayerToLobby(new Player('p1', { username: 'solo' }));

    const data = await manager.mutateGame(async (m) => {
      // replicate the loop's resolve step without a second player being flagged
      const p = m.state.getPlayer('p1')!;
      p.setFlag(PlayerFlags.WasKilled);
      await m.save();
      return p.has(PlayerFlags.WasKilled);
    });

    expect(data).toBe(true);
    const loaded = await repo.load(CHANNEL_ID);
    expect(loaded).not.toBeNull();
    const state = JSON.parse(loaded!.state);
    expect(state._activePlayers).toHaveLength(1);
  });
});

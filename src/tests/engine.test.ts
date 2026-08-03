import { describe, test, expect } from 'bun:test';
import { CommandInteraction, GuildTextBasedChannel, Message } from 'discord.js';
import { BaseGameManager, setDefaultGameRepository } from '../structures/BaseGameManager';
import { GameStateRepository, RedisLike, gameStateRepository } from '../storage/gameStateRepository';
import { registerGameMode } from '../structures/gameModes/registry';
import { Player } from '../structures/PlayerManager';
import { GamePhase } from '../types/states';
import type { PhaseDefinition } from '../types/gameModes';
import { RBoolean } from '../types/types';

const CHANNEL_ID = 'chan-engine-test';

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

class SequenceStubGame extends BaseGameManager {
  gameModeId = 'stub-sequence';
  minPlayers = 1;
  maxPlayers = 10;
  phaseBufferMS = 0;
  calls: string[] = [];

  async _handlePerformAction(_playerId: string, args: string[]): Promise<RBoolean> {
    return { ok: true };
  }

  async handleInGameMessage(_msg: Message): Promise<void> {}

  phaseSequence(): PhaseDefinition[] {
    return [
      {
        id: 'phase-a',
        duration: 1,
        run: async () => {
          this.calls.push(`run:a:round${this.state._round}`);
        },
      },
      {
        id: 'phase-b',
        duration: 1,
        run: async () => {
          this.calls.push(`run:b:round${this.state._round}`);
        },
        resolve: async (m) => {
          this.calls.push('resolve:b');
          m.state._flags++;
        },
      },
    ];
  }

  winCondition(): boolean {
    return this.state._flags >= 2;
  }

  async onGameStart(): Promise<void> {
    this.calls.push('onGameStart');
  }

  async onGameEnd(): Promise<void> {
    this.calls.push('onGameEnd');
  }
}

registerGameMode('stub-sequence', SequenceStubGame);

async function lobbyWithPlayer(repo: GameStateRepository): Promise<SequenceStubGame> {
  const manager = new SequenceStubGame(CHANNEL_ID, repo);
  await manager.createLobby();
  await manager.addPlayerToLobby(new Player('p1', { username: 'player1' }));
  return manager;
}

describe('BaseGameManager engine', () => {
  test('loops phases until winCondition, increments round, and resets after end', async () => {
    const { repo } = createFakeStore();
    const manager = await lobbyWithPlayer(repo);

    const res = await manager.startGame(fakeInteraction);

    expect(res.ok).toBe(true);
    expect(manager.calls).toEqual([
      'onGameStart',
      'run:a:round1',
      'run:b:round1',
      'resolve:b',
      'run:a:round2',
      'run:b:round2',
      'resolve:b',
      'onGameEnd',
    ]);
    expect(await repo.load(CHANNEL_ID)).toBeNull();
  });

  test('stops as soon as winCondition is met', async () => {
    const { repo } = createFakeStore();

    class EarlyWinGame extends SequenceStubGame {
      gameModeId = 'stub-early';
      winCondition(): boolean {
        return this.state._flags >= 1;
      }
    }
    registerGameMode('stub-early', EarlyWinGame);

    const manager = new EarlyWinGame(CHANNEL_ID, repo);
    await manager.createLobby();
    await manager.addPlayerToLobby(new Player('p1', { username: 'player1' }));

    const res = await manager.startGame(fakeInteraction);

    expect(res.ok).toBe(true);
    expect(manager.calls).toEqual(['onGameStart', 'run:a:round1', 'run:b:round1', 'resolve:b', 'onGameEnd']);
  });

  test('refuses to start when not in LOBBY phase', async () => {
    const { repo } = createFakeStore();
    const manager = new SequenceStubGame(CHANNEL_ID, repo);
    const res = await manager.startGame(fakeInteraction);
    expect(res.ok).toBe(false);
  });

  test('fromChannelId reconstructs the persisted mode', async () => {
    const { repo } = createFakeStore();
    await lobbyWithPlayer(repo);

    setDefaultGameRepository(repo);
    try {
      const gmResult = await BaseGameManager.fromChannelId(CHANNEL_ID);
      expect(gmResult.ok).toBeTrue();
      if (!gmResult.ok) return;
      expect(gmResult.value).toBeInstanceOf(BaseGameManager);
      expect(gmResult.value).not.toBeNull();
      expect(gmResult.value!.gameModeId).toBe('stub-sequence');
      expect(gmResult.value!.getPhase()).toBe(GamePhase.IN_LOBBY);
    } finally {
      setDefaultGameRepository(gameStateRepository);
    }
  });

  test('mutateGame applies changes and persists them', async () => {
    const { repo } = createFakeStore();
    const manager = await lobbyWithPlayer(repo);

    const result = await manager.mutateGame((m) => {
      m.state._round = 42;
      return m.save();
    });

    expect(result).toBeUndefined();
    const data = await repo.load(CHANNEL_ID);
    expect(data).not.toBeNull();
    expect(JSON.parse(data!.state)._round).toBe(42);
  });

  test('mutateGame no-ops when no game is persisted', async () => {
    const { repo } = createFakeStore();
    const manager = new SequenceStubGame(CHANNEL_ID, repo);
    const result = await manager.mutateGame((m) => m.state._round);
    expect(result).toBeUndefined();
  });
});

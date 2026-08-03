import { describe, test, expect } from 'bun:test';
import { GameStateRepository, RedisLike, GAME_TTL_SECONDS } from '../storage/gameStateRepository';
import { gameKey, gameStartRequestKey, lobbyCreatorKey } from '../storage/redisKeys';

function createFakeStore() {
  const data = new Map<string, string | Record<string, string>>();
  const ttls = new Map<string, number>();
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
    async expire(key, seconds) {
      ttls.set(key, seconds);
      return 1;
    },
  };
  return { repo: new GameStateRepository(store), data, ttls };
}

describe('GameStateRepository', () => {
  test('load returns null when no game exists', async () => {
    const { repo } = createFakeStore();
    expect(await repo.load('chan-1')).toBeNull();
  });

  test('save then load round-trips data and sets TTL', async () => {
    const { repo, data, ttls } = createFakeStore();
    await repo.save('chan-1', { mode: 'classic', state: '{"_round":1}' });
    const loaded = await repo.load('chan-1');
    expect(loaded).toEqual({ mode: 'classic', state: '{"_round":1}' });
    expect(ttls.get(gameKey('chan-1'))).toBe(GAME_TTL_SECONDS);
    expect(data.get(gameKey('chan-1'))).toBeDefined();
  });

  test('save merges into the existing hash', async () => {
    const { repo } = createFakeStore();
    await repo.save('chan-1', { mode: 'classic' });
    await repo.save('chan-1', { state: '{}' });
    const loaded = await repo.load('chan-1');
    expect(loaded).toEqual({ mode: 'classic', state: '{}' });
  });

  test('remove deletes the game key', async () => {
    const { repo } = createFakeStore();
    await repo.save('chan-1', { mode: 'classic', state: '{}' });
    await repo.remove('chan-1');
    expect(await repo.load('chan-1')).toBeNull();
  });

  test('lobby creator set/get/clear', async () => {
    const { repo, data } = createFakeStore();
    expect(await repo.getLobbyCreator('chan-1')).toBeNull();
    await repo.setLobbyCreator('chan-1', 'user-1');
    expect(await repo.getLobbyCreator('chan-1')).toBe('user-1');
    expect(data.get(lobbyCreatorKey('chan-1'))).toBe('user-1');
    await repo.clearLobbyCreator('chan-1');
    expect(await repo.getLobbyCreator('chan-1')).toBeNull();
  });

  test('start request uses NX so it is only set once', async () => {
    const { repo, data } = createFakeStore();
    await repo.requestGameStart('chan-1');
    await repo.requestGameStart('chan-1');
    expect(data.get(gameStartRequestKey('chan-1'))).toBe('1');
    expect(await repo.isGameStartRequested('chan-1')).toBe(true);
    await repo.clearGameStartRequest('chan-1');
    expect(await repo.isGameStartRequested('chan-1')).toBe(false);
  });
});

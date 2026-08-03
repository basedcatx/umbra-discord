import { describe, expect, test, vi } from 'bun:test';
import { Message } from 'discord.js';
import { ClassicWerewolfGame } from '../structures/gameModes/ClassicWerewolfGame';
import { registerGameMode } from '../structures/gameModes/registry';
import { GameStateRepository, RedisLike } from '../storage/gameStateRepository';
import { setSubPhase } from '../structures/gameSession';
import { GamePhase } from '../types/states';

vi.mock('../utils/interaction', () => ({
  autoDelete: () => {},
  safeReply: async () => undefined,
}));

registerGameMode('classic', ClassicWerewolfGame);

const CHANNEL_ID = 'chan-in-game-msg';

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
  return new GameStateRepository(store);
}

function makeGame(repo: GameStateRepository) {
  const game = new ClassicWerewolfGame(CHANNEL_ID, repo);
  game.state._phase = GamePhase.IN_GAME;
  return game;
}

function makeMessage() {
  const deleteFn = vi.fn().mockResolvedValue(undefined);
  const sendFn = vi.fn().mockResolvedValue({ delete: vi.fn().mockResolvedValue(undefined) });
  const msg = {
    deletable: true,
    delete: deleteFn,
    channel: { id: CHANNEL_ID, send: sendFn },
    author: { id: 'p1', bot: false },
  } as unknown as Message;
  return { msg, deleteFn, sendFn };
}

describe('ClassicWerewolfGame handleInGameMessage', () => {
  test('deletes the message and posts a notice during the night', async () => {
    const game = makeGame(createFakeStore());
    setSubPhase(CHANNEL_ID, 'night');
    const { msg, deleteFn, sendFn } = makeMessage();

    await game.handleInGameMessage(msg);

    expect(deleteFn).toHaveBeenCalledTimes(1);
    expect(sendFn).toHaveBeenCalledTimes(1);
    expect(sendFn.mock.calls[0][0]).toContain('night and voting are silent');
  });

  test('deletes the message and posts a notice during voting', async () => {
    const game = makeGame(createFakeStore());
    setSubPhase(CHANNEL_ID, 'voting');
    const { msg, deleteFn, sendFn } = makeMessage();

    await game.handleInGameMessage(msg);

    expect(deleteFn).toHaveBeenCalledTimes(1);
    expect(sendFn).toHaveBeenCalledTimes(1);
  });

  test('leaves messages alone during the day', async () => {
    const game = makeGame(createFakeStore());
    setSubPhase(CHANNEL_ID, 'day');
    const { msg, deleteFn, sendFn } = makeMessage();

    await game.handleInGameMessage(msg);

    expect(deleteFn).not.toHaveBeenCalled();
    expect(sendFn).not.toHaveBeenCalled();
  });

  test('does nothing when the game is not in progress', async () => {
    const game = makeGame(createFakeStore());
    game.state._phase = GamePhase.IN_LOBBY;
    setSubPhase(CHANNEL_ID, 'night');
    const { msg, deleteFn, sendFn } = makeMessage();

    await game.handleInGameMessage(msg);

    expect(deleteFn).not.toHaveBeenCalled();
    expect(sendFn).not.toHaveBeenCalled();
  });
});

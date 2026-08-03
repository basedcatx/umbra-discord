import { redis } from 'bun';
import { gameInitKey, gameKey, gameStartRequestKey, lobbyCreatorKey } from './redisKeys';

export const GAME_TTL_SECONDS = 60 * 30;
export const LOBBY_CREATOR_TTL_SECONDS = 5 * 60;
export const GAME_START_REQUEST_TTL_SECONDS = 60;

export type StoredGameData = Record<string, string>;

export interface RedisLike {
  exists(key: string): Promise<boolean>;
  hgetall(key: string): Promise<Record<string, string>>;
  hset(key: string, fields: Record<string, string>): Promise<number>;
  del(...keys: string[]): Promise<number>;
  set(key: string, value: string, ...options: string[]): Promise<'ok' | string | null>;
  get(key: string): Promise<string | null>;
  expire(key: string, seconds: number): Promise<number>;
}

export class GameStateRepository {
  constructor(private readonly store: RedisLike = redis) {}

  async load(channelId: string): Promise<StoredGameData | null> {
    const key = gameKey(channelId);
    if (!(await this.store.exists(key))) return null;
    return await this.store.hgetall(key);
  }

  async save(channelId: string, data: StoredGameData): Promise<void> {
    const key = gameKey(channelId);
    await this.store.hset(key, data);
    await this.store.expire(key, GAME_TTL_SECONDS);
  }

  async remove(channelId: string): Promise<void> {
    await this.store.del(gameKey(channelId));
  }

  /* Lobby */

  async setLobbyCreator(channelId: string, userId: string): Promise<void> {
    await this.store.set(lobbyCreatorKey(channelId), userId, 'EX', String(LOBBY_CREATOR_TTL_SECONDS));
  }

  async getLobbyCreator(channelId: string): Promise<string | null> {
    return await this.store.get(lobbyCreatorKey(channelId));
  }

  async clearLobbyCreator(channelId: string): Promise<void> {
    await this.store.del(lobbyCreatorKey(channelId));
  }
  //////////////////

  async requestGameStart(channelId: string): Promise<void> {
    await this.store.set(gameStartRequestKey(channelId), '1', 'NX', 'EX', String(GAME_START_REQUEST_TTL_SECONDS));
  }

  async isGameStartRequested(channelId: string): Promise<boolean> {
    return await this.store.exists(gameStartRequestKey(channelId));
  }

  async clearGameStartRequest(channelId: string): Promise<void> {
    await this.store.del(gameStartRequestKey(channelId));
  }

  async tryCreateLobby(channelId: string): Promise<boolean> {
    const res = await this.store.set(gameInitKey(channelId), '1', 'NX', 'EX', String(GAME_TTL_SECONDS));
    return res !== null;
  }

  //---------

  async clearLobbyClaim(channelId: string) {
    await this.store.del(gameInitKey(channelId));
  }
}

export const gameStateRepository = new GameStateRepository();

type ERROR_CAUSE =
  | 'GAME_MAX_PLAYER_ERROR'
  | 'GAME_MIN_PLAYER_ERROR'
  | 'GAME_INVALID_STATE'
  | 'PLAYER_NOT_IN_LOBBY'
  | 'GAME_IN_PROGRESS'
  | 'NO_LOBBY_IN_PROGRESS_ERROR'
  | 'LOBBY_EXPIRED_ERROR'
  | 'LOBBY_FULL_ERROR'
  | 'GUILD_NOT_FOUND'
  | 'CHANNEL_NOT_FOUND'
  | 'PLAYER_INVALID_STATE_ERROR'
  | 'PLAYER_ALREADY_IN_LOBBY_ERROR'
  | 'INVALID_ACTION'
  | 'INVALID_PLAYER'
  | 'PERM_ERROR';

export class GameError extends Error {
  public readonly c: ERROR_CAUSE;

  constructor(msg: string, cause: ERROR_CAUSE) {
    super(msg, { cause });
    this.c = cause;
  }

  public getMessage() {
    return this.message;
  }

  public getCause() {
    return this.c;
  }
}

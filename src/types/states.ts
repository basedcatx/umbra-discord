// This refers to the game's state (When the thread is created, what happens next.)

// This now useless; we have a more dynamic way to go about this
export const enum GamePhase {
  NONE= 'none',
  IN_LOBBY= 'lobby',
  IN_GAME= 'ingame'
}

export const enum ActivityState {
  IDLE = 'Idle',
  IN_LOBBY = 'Lobby',
  IN_GAME = 'Playing',
}

export const enum LifeStatus {
  ALIVE = 'Alive',
  DEAD = 'Dead',
}

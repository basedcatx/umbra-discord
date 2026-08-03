export const GameInfoConstants = {
  classic: {
    mode: 'Classic',
    desc: 'Everyone is given a role at the start of the game. The goal is to vote out all the imposters (suspects) before they take you all out. Stay safe!',
  },
} as const;

export type GameInfoConstants = (typeof GameInfoConstants)[keyof typeof GameInfoConstants];

export const GameCurrentEvent = {
  headline: 'Project: Detach',
  msg: 'Trust no one',
} as const;

export const LobbyInfo = {
  info: `The lobby has been created.\nThe game would automatically begin when the time runs out with minimum players available, or when this lobby's initiator decides.`,
} as const;

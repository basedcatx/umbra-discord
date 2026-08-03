// Process-local, per-channel transient session data for a running game.
//
// Only the coarse `GameState._phase` (+ players/flags/round) is persisted to Redis.
// Sub-phase and votes are inherently ephemeral: they only matter while the process
// is alive and a round is in flight. A crash loses them, and the game resumes from
// the DAY of the persisted round. This must NOT live on a manager instance, because
// every interaction hydrates a fresh manager via `fromChannelId`.

interface GameSession {
  subPhase: string;
  votes: Map<string, string>;
}

const sessions = new Map<string, GameSession>();

const DEFAULT_SUB_PHASE = 'day';

function getOrCreateSession(channelId: string): GameSession {
  let session = sessions.get(channelId);
  if (!session) {
    session = { subPhase: DEFAULT_SUB_PHASE, votes: new Map() };
    sessions.set(channelId, session);
  }
  return session;
}

export function setSubPhase(channelId: string, subPhase: string): void {
  getOrCreateSession(channelId).subPhase = subPhase;
}

export function getSubPhase(channelId: string): string {
  return sessions.get(channelId)?.subPhase ?? DEFAULT_SUB_PHASE;
}

export function recordVote(channelId: string, playerId: string, targetId: string): void {
  getOrCreateSession(channelId).votes.set(playerId, targetId);
}

export function getVotes(channelId: string): Map<string, string> {
  const votes = sessions.get(channelId)?.votes;
  return votes ? new Map(votes) : new Map();
}

export function clearVotes(channelId: string): void {
  sessions.get(channelId)?.votes.clear();
}

export function clearSession(channelId: string): void {
  sessions.delete(channelId);
}

import { describe, test, expect } from 'bun:test';
import { ClassicWerewolfGame } from '../structures/gameModes/ClassicWerewolfGame';
import { GameStateRepository, RedisLike } from '../storage/gameStateRepository';
import { Player, PlayerFlags } from '../structures/PlayerManager';
import { PlayerRoles, Phases } from '../structures/gameModes/classic';
import { clearSession, getSubPhase, getVotes, setSubPhase } from '../structures/gameSession';

const CHANNEL_ID = 'chan-action-protocol-test';

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

function makeGame() {
  const { repo } = createFakeStore();
  clearSession(CHANNEL_ID);
  return new ClassicWerewolfGame(CHANNEL_ID, repo);
}

async function addPlayers(gm: ClassicWerewolfGame, ids: string[]) {
  await gm.createLobby();
  for (const id of ids) {
    await gm.addPlayerToLobby(new Player(id, { username: id }));
  }
}

describe('action protocol', () => {
  test('vote records the target from args[1]', async () => {
    const gm = makeGame();
    await addPlayers(gm, ['a1', 'a2', 'a3']);
    setSubPhase(CHANNEL_ID, Phases.VOTING);

    const res = await gm.performAction('a1', 'vote:a2:');
    expect(res.ok).toBeTrue();
    expect(getVotes(CHANNEL_ID).get('a1')).toBe('a2');
  });

  test('vote:skip records a skip vote', async () => {
    const gm = makeGame();
    await addPlayers(gm, ['a1', 'a2', 'a3']);
    setSubPhase(CHANNEL_ID, Phases.VOTING);

    const res = await gm.performAction('a1', 'vote:skip');
    expect(res.ok).toBeTrue();
    expect(getVotes(CHANNEL_ID).get('a1')).toBe('skip');
  });

  test('voting is rejected outside the voting phase', async () => {
    const gm = makeGame();
    await addPlayers(gm, ['a1', 'a2', 'a3']);

    const res = await gm.performAction('a1', 'vote:a2:');
    expect(res.ok).toBeFalse();
  });

  test('imposter kill flags the target', async () => {
    const gm = makeGame();
    await addPlayers(gm, ['a1', 'a2', 'a3', 'a4']);
    setSubPhase(CHANNEL_ID, Phases.NIGHT);
    gm.state.getPlayer('a1')!.role = PlayerRoles.IMPOSTER;

    const res = await gm.performAction('a1', 'kill:a2:');
    expect(res.ok).toBeTrue();
    expect(gm.state.getPlayer('a2')!.has(PlayerFlags.WasKilled)).toBeTrue();
    expect(gm.state.getPlayer('a1')!.has(PlayerFlags.HasPerformedAction)).toBeTrue();
  });

  test('doctor save flags the target', async () => {
    const gm = makeGame();
    await addPlayers(gm, ['a1', 'a2', 'a3', 'a4']);
    setSubPhase(CHANNEL_ID, Phases.NIGHT);
    gm.state.getPlayer('a3')!.role = PlayerRoles.DOCTOR;

    const res = await gm.performAction('a3', 'save:a4:');
    expect(res.ok).toBeTrue();
    expect(gm.state.getPlayer('a4')!.has(PlayerFlags.WasSaved)).toBeTrue();
  });

  test('kill with a non-existent target is rejected', async () => {
    const gm = makeGame();
    await addPlayers(gm, ['a1', 'a2']);
    setSubPhase(CHANNEL_ID, Phases.NIGHT);
    gm.state.getPlayer('a1')!.role = PlayerRoles.IMPOSTER;

    const res = await gm.performAction('a1', 'kill:ghost:');
    expect(res.ok).toBeFalse();
  });

  test('townie cannot kill', async () => {
    const gm = makeGame();
    await addPlayers(gm, ['a1', 'a2']);
    setSubPhase(CHANNEL_ID, Phases.NIGHT);

    const res = await gm.performAction('a1', 'kill:a2:');
    expect(res.ok).toBeFalse();
  });

  test('night actions are rejected during voting', async () => {
    const gm = makeGame();
    await addPlayers(gm, ['a1', 'a2']);
    setSubPhase(CHANNEL_ID, Phases.VOTING);
    gm.state.getPlayer('a1')!.role = PlayerRoles.IMPOSTER;

    const res = await gm.performAction('a1', 'kill:a2:');
    expect(res.ok).toBeFalse();
  });
});

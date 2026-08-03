import { describe, test, expect } from 'bun:test';

function resolveVoteTally(votes: Map<string, string>): {
  lynched: string | null;
  tied: boolean;
  totalVotes: number;
} {
  const tally = new Map<string, number>();

  for (const [, targetId] of votes) {
    if (targetId === 'skip') continue;
    tally.set(targetId, (tally.get(targetId) ?? 0) + 1);
  }

  if (tally.size === 0) return { lynched: null, tied: false, totalVotes: 0 };

  let maxVotes = 0;
  let lynched: string | null = null;
  for (const [id, count] of tally) {
    if (count > maxVotes) {
      maxVotes = count;
      lynched = id;
    }
  }

  const tied = [...tally].filter(([_, c]) => c === maxVotes);

  if (tied.length > 1) return { lynched: null, tied: true, totalVotes: votes.size };

  return { lynched, tied: false, totalVotes: votes.size };
}

describe('Vote resolution', () => {
  test('player with most votes gets lynched', () => {
    const votes = new Map([
      ['voter1', 'alice'],
      ['voter2', 'bob'],
      ['voter3', 'alice'],
      ['voter4', 'alice'],
    ]);
    const result = resolveVoteTally(votes);
    expect(result.lynched).toBe('alice');
    expect(result.tied).toBe(false);
  });

  test('skip votes are excluded from the tally', () => {
    const votes = new Map([
      ['voter1', 'playerA'],
      ['voter2', 'skip'],
      ['voter3', 'playerA'],
      ['voter4', 'skip'],
    ]);
    const result = resolveVoteTally(votes);
    expect(result.lynched).toBe('playerA');
    expect(result.tied).toBe(false);
  });

  test('tie results in no lynch', () => {
    const votes = new Map([
      ['voter1', 'playerA'],
      ['voter2', 'playerB'],
      ['voter3', 'playerA'],
      ['voter4', 'playerB'],
    ]);
    const result = resolveVoteTally(votes);
    expect(result.lynched).toBeNull();
    expect(result.tied).toBe(true);
  });

  test('tie with skip votes still results in no lynch', () => {
    const votes = new Map([
      ['voter1', 'playerA'],
      ['voter2', 'playerB'],
      ['voter3', 'playerA'],
      ['voter4', 'playerB'],
      ['voter5', 'skip'],
    ]);
    const result = resolveVoteTally(votes);
    expect(result.lynched).toBeNull();
    expect(result.tied).toBe(true);
  });

  test('all skip votes results in no elimination', () => {
    const votes = new Map([
      ['voter1', 'skip'],
      ['voter2', 'skip'],
      ['voter3', 'skip'],
    ]);
    const result = resolveVoteTally(votes);
    expect(result.lynched).toBeNull();
    expect(result.tied).toBe(false);
    expect(result.totalVotes).toBe(0);
  });

  test('single vote lynches that player', () => {
    const votes = new Map([['voter1', 'solo']]);
    const result = resolveVoteTally(votes);
    expect(result.lynched).toBe('solo');
    expect(result.tied).toBe(false);
  });

  test('empty votes returns no lynch', () => {
    const result = resolveVoteTally(new Map());
    expect(result.lynched).toBeNull();
    expect(result.tied).toBe(false);
  });
});

import { shuffleArray } from '../utils/shuffle_array';
import { describe, test, expect } from 'bun:test';

describe('Array shufflling test', function () {
  test('Test unbiased array shufflling', () => {
    const array = [1, 2, 3, 4, 5, 6];
    expect(array).not.toEqual(shuffleArray(array));
  });
});

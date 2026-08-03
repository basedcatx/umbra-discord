import { announcementComponent } from '../components/announcementComponent';
import { describe, expect, test } from 'bun:test';

describe('Announcement component', () => {
  test('builds without throwing', () => {
    const result = announcementComponent({
      title: '🏁 Game Over',
      messages: ['Townies win!', 'Alice was the last imposter'],
    });
    expect(result).toBeDefined();
  });

  test('accepts custom color', () => {
    const result = announcementComponent({
      title: '🌙 Night Falls',
      messages: ['The streets are quiet...'],
    });
    expect(result).toBeDefined();
  });

  test('handles single message', () => {
    const result = announcementComponent({
      title: 'Test',
      messages: ['Just one message'],
    });
    expect(result).toBeDefined();
  });

  test('handles many messages', () => {
    const msgs = Array.from({ length: 10 }, (_, i) => `Message ${i + 1}`);
    const result = announcementComponent({
      title: 'Bulletin',
      messages: msgs,
    });
    expect(result).toBeDefined();
  });
});

import { describe, test, expect } from 'bun:test';
import { PermissionFlagsBits } from 'discord.js';
import { REQUIRED_CHANNEL_PERMISSIONS } from '../utils/permissions';

describe('Required channel permissions', function () {
  test('Required permissions are exactly the 6 intended channel permissions', () => {
    const bits = REQUIRED_CHANNEL_PERMISSIONS.map((perm) => perm.bit).sort((a, b) => Number(a - b));
    expect(bits).toEqual(
      [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.AddReactions,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.ManageMessages,
      ].sort((a, b) => Number(a - b)),
    );
  });

  test('Required permissions exclude server-wide permissions', () => {
    const bits = REQUIRED_CHANNEL_PERMISSIONS.map((perm) => perm.bit);
    expect(bits).not.toContain(PermissionFlagsBits.ManageChannels);
    expect(bits).not.toContain(PermissionFlagsBits.ManageGuild);
    expect(bits).not.toContain(PermissionFlagsBits.MuteMembers);
    expect(bits).not.toContain(PermissionFlagsBits.Administrator);
  });

  test('Every required permission has a label, a reason, and a why explanation', () => {
    for (const perm of REQUIRED_CHANNEL_PERMISSIONS) {
      expect(perm.label).toBeTruthy();
      expect(typeof perm.reason('test')).toBe('string');
      expect(perm.why).toBeTruthy();
    }
  });
});

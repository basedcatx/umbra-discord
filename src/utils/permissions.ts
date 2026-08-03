import { GuildChannel, PermissionFlagsBits, PermissionsBitField } from 'discord.js';
import { ClientWithExtendedTypes, RBoolean } from '../types/types';
import { GameError } from '../errors/GameError';
import { log } from './logger';

function checkPermission(perm: bigint, client: ClientWithExtendedTypes, channel: GuildChannel): boolean {
  const clientId = client.user?.id || '';
  return Boolean(channel.permissionsFor(clientId)?.has(new PermissionsBitField(perm)));
}

export interface RequiredChannelPermission {
  bit: bigint;
  label: string;
  why: string;
  reason: (channelName: string) => string;
}

export const REQUIRED_CHANNEL_PERMISSIONS: RequiredChannelPermission[] = [
  {
    bit: PermissionFlagsBits.ViewChannel,
    label: 'View Channel',
    why: 'Needed so I can see this channel and post game content, events, and announcements here.',
    reason: (name) =>
      `I lack the permissions to view \`${name}\` channel. If it is a private channel ensure that you add me/my role to the channel permissions/category > permissions. Something went wrong, please reinstall me if you are the server owner or use the /permissions command to see all granted permissions, but if it persists create a ticket`,
  },
  {
    bit: PermissionFlagsBits.SendMessages,
    label: 'Send Messages',
    why: 'Required to post game events, voting, and announcements in this channel.',
    reason: (name) =>
      `I lack the permissions to send messages to \`${name}\` channel. Something went wrong, please reinstall me if you are the server owner or use the /permissions command to see all granted permissions, but if it persists create a ticket`,
  },
  {
    bit: PermissionFlagsBits.EmbedLinks,
    label: 'Embed Links',
    why: 'Lets me render the embeds, images, and components used by game events and announcements.',
    reason: (name) =>
      `I lack the permissions to create embeds and links in \`${name}\`. Something went wrong, please reinstall me if you are the server owner or use the /permissions command to see all granted permissions, but if it persists create a ticket`,
  },
  {
    bit: PermissionFlagsBits.AddReactions,
    label: 'Add Reactions',
    why: 'Lets me add reactions so I can run polls and interactive voting during games.',
    reason: (name) =>
      `I lack the permissions to add reactions to messages in \`${name}\`. Something went wrong, please reinstall me if you are the server owner or use the /permissions command to see all granted permissions, but if it persists create a ticket`,
  },
  {
    bit: PermissionFlagsBits.AttachFiles,
    label: 'Attach Files',
    why: 'Lets me attach the media files used by game events and announcements.',
    reason: (name) =>
      `I lack the permissions to attach files in \`${name}\`. Something went wrong, please reinstall me if you are the server owner or use the /permissions command to see all granted permissions, but if it persists create a ticket`,
  },
  {
    bit: PermissionFlagsBits.ManageMessages,
    label: 'Manage Messages',
    why: 'Lets me manage and clean up game messages such as polls and votes between phases.',
    reason: (name) =>
      `I lack the permissions to manage messages in \`${name}\`. Something went wrong, please reinstall me if you are the server owner or use the /permissions command to see all granted permissions, but if it persists create a ticket`,
  },
];

export interface ChannelPermissionState {
  label: string;
  why: string;
  granted: boolean;
}

export function channelPermissionsState(channel: GuildChannel, client: ClientWithExtendedTypes): ChannelPermissionState[] {
  return REQUIRED_CHANNEL_PERMISSIONS.map((perm) => ({
    label: perm.label,
    why: perm.why,
    granted: checkPermission(perm.bit, client, channel),
  }));
}

export async function checkGuildAndChannelPermissions(
  channel: GuildChannel,
  client: ClientWithExtendedTypes,
): Promise<RBoolean> {
  if (!channel.isTextBased()) {
    return { ok: false, error: new GameError(`Channel: ${channel.name} is not a text based channel`, 'PERM_ERROR') };
  }

  for (const perm of REQUIRED_CHANNEL_PERMISSIONS) {
    if (!checkPermission(perm.bit, client, channel)) {
      return { ok: false, error: new GameError(perm.reason(channel.name), 'PERM_ERROR') };
    }
  }

  log.debug('Setup complete');
  return { ok: true };
}

import { Message } from 'discord.js';
import { BaseGameManager } from '../structures/BaseGameManager';
import { ClientWithExtendedTypes } from '../types/types';

export async function handleInGameMessage(client: ClientWithExtendedTypes, msg: Message) {
  const gameManagerResult = await BaseGameManager.fromChannelId(msg.channel.id);
  if (!gameManagerResult.ok) return;

  return await gameManagerResult.value.handleInGameMessage(msg);
}

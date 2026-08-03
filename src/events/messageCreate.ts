import { Events, Message } from 'discord.js';
import { ClientWithExtendedTypes } from '../types/types';
import { handleInGameMessage } from '../interactionHandlers/handleInGameMessage';

const messageCreate = {
  name: Events.MessageCreate,
  once: false,
  execute: async function (client: ClientWithExtendedTypes, msg: Message) {
    if (!msg.author.bot) return await handleInGameMessage(client, msg);
  },
};

export default messageCreate;

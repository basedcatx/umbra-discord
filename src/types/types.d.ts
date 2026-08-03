import { Client, Collection, CommandInteraction, Message } from 'discord.js';
import { GameError } from '../errors/GameError';

export interface SlashCommandType {
  name: string;
  description: string;
  cooldown: number;
  execute(client: ClientWithExtendedTypes, interaction: Message | CommandInteraction): Promise<void>;
}

export interface Command {
  description: string;
  execute(client: ClientWithExtendedTypes, ...args: any[]): Promise<unknown>;
}

export interface ClientWithExtendedTypes extends Client {
  messageCommands: Collection<string, Command>;
  interactionCommands: Collection<string, Command>;
}

export type RBoolean = { ok: false; error: GameError | Error } | { ok: true };
export type RVBoolean<T> = { ok: false; error: GameError | Error } | { ok: true; value: T };

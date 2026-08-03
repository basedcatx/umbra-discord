import { DiscordAPIError, Message } from 'discord.js';
import type {
  ButtonInteraction,
  CommandInteraction,
  InteractionDeferReplyOptions,
  InteractionReplyOptions,
  InteractionResponse,
  InteractionUpdateOptions,
  MessageEditOptions,
  MessagePayload,
  StringSelectMenuInteraction,
} from 'discord.js';

// 10062 = Unknown interaction (expired before the initial response was sent)
// 10063 = Unknown webhook (interaction response webhook is no longer valid)
const SWALLOWABLE_INTERACTION_ERROR_CODES = new Set([10062, 10063]);

export function isSwallowableInteractionError(err: unknown): boolean {
  if (!(err instanceof DiscordAPIError)) return false;
  return typeof err.code === 'number' && SWALLOWABLE_INTERACTION_ERROR_CODES.has(err.code);
}

export async function safeReply(
  interaction: CommandInteraction | ButtonInteraction | StringSelectMenuInteraction,
  options: string | MessagePayload | InteractionReplyOptions,
): Promise<InteractionResponse | undefined> {
  try {
    return await interaction.reply(options);
  } catch (err) {
    if (isSwallowableInteractionError(err)) return undefined;
    throw err;
  }
}

export async function safeDeferReply(
  interaction: CommandInteraction | ButtonInteraction | StringSelectMenuInteraction,
  options?: InteractionDeferReplyOptions,
): Promise<InteractionResponse | undefined> {
  try {
    return await interaction.deferReply(options);
  } catch (err) {
    if (isSwallowableInteractionError(err)) return undefined;
    throw err;
  }
}

export async function safeEditReply(
  interaction: CommandInteraction | ButtonInteraction | StringSelectMenuInteraction,
  options: string | MessagePayload | MessageEditOptions,
): Promise<Message | undefined> {
  try {
    return await interaction.editReply(options);
  } catch (err) {
    if (isSwallowableInteractionError(err)) return undefined;
    throw err;
  }
}

export async function safeUpdate(
  interaction: ButtonInteraction | StringSelectMenuInteraction,
  options?: InteractionUpdateOptions,
): Promise<InteractionResponse | undefined> {
  try {
    return options === undefined ? await interaction.update() : await interaction.update(options);
  } catch (err) {
    if (isSwallowableInteractionError(err)) return undefined;
    throw err;
  }
}

export function autoDelete(response: InteractionResponse | Message | undefined, delayMs = 5_000): void {
  if (!response) return;
  setTimeout(() => void response.delete().catch(() => {}), delayMs);
}

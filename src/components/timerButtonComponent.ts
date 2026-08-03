import { ButtonBuilder, ButtonStyle } from 'discord.js';
import { BTN_IDS } from '../types/globals';

export function timerButtonComponent(timer?: number, disabled = false) {
  const btn = new ButtonBuilder();
  btn.setLabel(`Time: ${timer}s`).setCustomId(BTN_IDS.CHECK_GAME_TIME_BTN).setStyle(ButtonStyle.Secondary);
  if (disabled) btn.setDisabled(true);
  if (!timer) {
    return btn;
  }
  if (timer <= 10) return btn.setStyle(ButtonStyle.Danger);
  if (timer <= 30) return btn.setStyle(ButtonStyle.Primary);
  return btn;
}

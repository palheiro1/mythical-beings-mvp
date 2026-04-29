const BOT_SELECTION_STORAGE_KEY = 'mythical-beings:bot-selected-creatures';

export function isValidBotCreatureSelection(value: unknown): value is string[] {
  return Array.isArray(value) && value.length === 3 && value.every(item => typeof item === 'string' && item.length > 0) && new Set(value).size === 3;
}

export function readBotCreatureSelection(): string[] | null {
  try {
    const raw = window.sessionStorage.getItem(BOT_SELECTION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isValidBotCreatureSelection(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeBotCreatureSelection(selectedCreatures: string[]): void {
  window.sessionStorage.setItem(BOT_SELECTION_STORAGE_KEY, JSON.stringify(selectedCreatures));
}

export function clearBotCreatureSelection(): void {
  window.sessionStorage.removeItem(BOT_SELECTION_STORAGE_KEY);
}

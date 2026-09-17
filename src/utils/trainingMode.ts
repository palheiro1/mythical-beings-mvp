export type TrainingMode = 'guided' | 'free';
export const GUIDED_TEAM = ['tarasca', 'adaro', 'tulpar'];
export const TUTORIAL_PROGRESS_KEY = 'wisdom-duel-training-tutorial-v2';

export function trainingModeFromSearch(search: string): TrainingMode {
  return new URLSearchParams(search).get('mode') === 'guided' ? 'guided' : 'free';
}

export function rememberTutorial(completed: boolean): void {
  try {
    localStorage.setItem(TUTORIAL_PROGRESS_KEY, completed ? 'completed' : 'skipped');
  } catch { /* Learning remains available when browser storage is blocked. */ }
}

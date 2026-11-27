// Persistence helpers tracking whether the player has opened the interactive
// tutorial (R14). The interactive tutorial itself runs on /how-to-play/tutorial
// using the live RoundStage HUD.

const STORAGE_KEY = 'terraguessr.tutorialSeen.v1'

export function hasSeenTutorial(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function markTutorialSeen(): void {
  try {
    localStorage.setItem(STORAGE_KEY, '1')
  } catch {
    /* storage is optional */
  }
}

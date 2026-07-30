export type AudioCue =
  | "ui"
  | "pickup"
  | "woodcutting"
  | "mining"
  | "fishing"
  | "cooking"
  | "attack"
  | "hit"
  | "rare";

/**
 * Phase One deliberately ships without uncertain third-party audio.
 * This service is the single integration boundary for clearly licensed audio later.
 */
class AudioService {
  private unlocked = false;

  unlock(): void {
    this.unlocked = true;
  }

  play(_cue: AudioCue, _volume = 1): void {
    if (!this.unlocked) return;
    // Intentionally silent until a clearly licensed audio set is selected.
  }

  pause(): void {
    // Future ambient/music sources pause here.
  }
}

export const audio = new AudioService();

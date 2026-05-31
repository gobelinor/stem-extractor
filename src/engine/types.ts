// Types partagés du moteur (agnostiques du framework UI).

export type MidiMessage = number[]; // ex: [0xB0, 9, 127] (CC9 ch1 = mute)

export interface MidiPortInfo {
  id: string;
  name: string;
  manufacturer: string;
}

export interface AudioDeviceInfo {
  deviceId: string;
  label: string;
}

export type BarLength = 8 | 16;

export interface CaptureSettings {
  /** Nom du projet → utilisé pour nommer les stems et le dossier de download. */
  projectName: string;
  bpm: number;
  bars: BarLength;
  /** Décalage MIDI(start) → arrivée audio USB, en ms. Trim de la fenêtre. */
  latencyOffsetMs: number;
  /** Secondes enregistrées en plus des bars, pour laisser sonner les tails. */
  tailSec: number;
}

export interface Stem {
  track: number; // 1-based
  name: string; // ex: "track-01.wav"
  blob: Blob;
  url: string;
  durationSec: number;
}

export type CaptureStatus =
  | { phase: "idle" }
  | { phase: "running"; track: number; total: number }
  | { phase: "done" }
  | { phase: "error"; message: string };

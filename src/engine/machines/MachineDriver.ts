import type { MidiMessage } from "../types";

/**
 * Contrat générique d'une machine. Tout le cœur (clock, capture, WAV,
 * orchestration) ne dépend que de cette interface. Ajouter une machine =
 * implémenter ce contrat dans un nouveau fichier + l'enregistrer.
 */
export interface MachineDriver {
  readonly id: string;
  readonly name: string;
  readonly trackCount: number;

  /** Reconnaît le port MIDI de la machine d'après son nom. */
  midiPortMatch(name: string): boolean;
  /** Reconnaît le device audio de la machine d'après son label. */
  audioDeviceMatch(label: string): boolean;

  /** Nom lisible d'une piste (ex: "Track 1"). */
  trackLabel(track: number): string;

  /** Messages pour solo'er une piste (la cible joue, les autres sont mutées). */
  soloTrack(track: number): MidiMessage[];
  /** Réinitialise : toutes les pistes audibles. */
  unmuteAll(): MidiMessage[];
}

import type { MidiEngine } from "./MidiEngine";
import { clockTick, startMsg, stopMsg } from "./messages";

const PPQN = 24; // ticks par noire (standard MIDI)
const BEATS_PER_BAR = 4; // 4/4 au POC
const LEAD_MS = 120; // marge avant le downbeat pour que la 1re livraison soit programmée

export interface ClockRun {
  /** performance.now() du downbeat (envoi du START). */
  startTime: number;
  /** performance.now() de fin (STOP), = startTime + durée musicale. */
  endTime: number;
  /** Durée musicale exacte en secondes (bars × beats / bps). */
  durationSec: number;
  /** Résout quand la lecture est terminée (après STOP). */
  done: Promise<void>;
}

/**
 * L'app est l'horloge maître : envoie START, programme tous les ticks de clock
 * à 24 ppqn via send(msg, timestamp), puis STOP. Comme on connaît l'instant du
 * downbeat et la durée, la fenêtre d'enregistrement est déterministe.
 */
export class ClockMaster {
  constructor(private midi: MidiEngine) {}

  runBars(bars: number, bpm: number): ClockRun {
    const tickMs = 60000 / bpm / PPQN;
    const totalTicks = bars * BEATS_PER_BAR * PPQN;
    const durationSec = (bars * BEATS_PER_BAR * 60) / bpm;

    const startTime = performance.now() + LEAD_MS;
    const endTime = startTime + totalTicks * tickMs;

    // START au downbeat.
    this.midi.send(startMsg, startTime);
    // Tous les ticks programmés à l'avance.
    for (let i = 0; i < totalTicks; i++) {
      this.midi.send(clockTick, startTime + i * tickMs);
    }
    // STOP en fin de fenêtre.
    this.midi.send(stopMsg, endTime);

    const done = new Promise<void>((resolve) => {
      const wait = endTime - performance.now() + 20;
      setTimeout(resolve, Math.max(0, wait));
    });

    return { startTime, endTime, durationSec, done };
  }

  /** Arrêt d'urgence (envoyé immédiatement). */
  stopNow(): void {
    this.midi.send(stopMsg);
  }
}

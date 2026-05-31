import type { MidiEngine } from "../midi/MidiEngine";
import { ClockMaster } from "../midi/ClockMaster";
import type { AudioRecorder } from "../audio/AudioRecorder";
import type { MachineDriver } from "../machines/MachineDriver";
import { encodeWav } from "../audio/wav-encoder";
import { stemFileName } from "../io/naming";
import type { CaptureSettings, CaptureStatus, Stem } from "../types";

const SETTLE_MS = 80; // laisse les mutes s'appliquer avant de lancer la lecture

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Boucle sur chaque piste : solo (CC9) → lecture N bars (app = clock master) en
 * enregistrant → extraction de la fenêtre alignée → encodage WAV. À la fin,
 * réinitialise les mutes.
 */
export class StemCapture {
  private clock: ClockMaster;
  constructor(
    private midi: MidiEngine,
    private recorder: AudioRecorder,
    private driver: MachineDriver
  ) {
    this.clock = new ClockMaster(midi);
  }

  async run(
    settings: CaptureSettings,
    onProgress: (s: CaptureStatus) => void
  ): Promise<Stem[]> {
    const stems: Stem[] = [];
    const tailSec = Math.max(0, settings.tailSec);
    const targets: number[] = [];
    for (let t = 1; t <= this.driver.trackCount; t++) {
      if (!settings.disabledTracks.includes(t)) targets.push(t);
    }

    try {
      for (let i = 0; i < targets.length; i++) {
        const track = targets[i];
        onProgress({ phase: "running", track, index: i + 1, total: targets.length });

        this.midi.sendMany(this.driver.soloTrack(track));
        await sleep(SETTLE_MS);

        this.recorder.startCapture();
        const run = this.clock.runBars(settings.bars, settings.bpm);
        await run.done;
        // Continue d'enregistrer pendant la tail (reverb/pad) après le STOP.
        if (tailSec > 0) await sleep(tailSec * 1000);
        const rec = this.recorder.stopCapture();

        const window = this.recorder.extractWindow(
          rec,
          run.startTime + settings.latencyOffsetMs,
          run.durationSec + tailSec
        );
        const blob = encodeWav(window, rec.sampleRate);
        const name = stemFileName(settings.projectName, settings.bpm, track);
        stems.push({
          track,
          name,
          blob,
          url: URL.createObjectURL(blob),
          durationSec: run.durationSec + tailSec,
        });
      }
      this.midi.sendMany(this.driver.unmuteAll());
      onProgress({ phase: "done" });
      return stems;
    } catch (err) {
      this.midi.sendMany(this.driver.unmuteAll());
      this.clock.stopNow();
      onProgress({ phase: "error", message: err instanceof Error ? err.message : String(err) });
      throw err;
    }
  }
}

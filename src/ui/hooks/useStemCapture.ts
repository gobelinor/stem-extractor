import { useCallback, useState } from "react";
import { StemCapture } from "../../engine/capture/StemCapture";
import type { MidiEngine } from "../../engine/midi/MidiEngine";
import type { AudioRecorder } from "../../engine/audio/AudioRecorder";
import type { MachineDriver } from "../../engine/machines/MachineDriver";
import type { CaptureSettings, CaptureStatus, Stem } from "../../engine/types";

export function useStemCapture(
  midi: MidiEngine,
  recorder: AudioRecorder,
  driver: MachineDriver | null
) {
  const [status, setStatus] = useState<CaptureStatus>({ phase: "idle" });
  const [stems, setStems] = useState<Stem[]>([]);

  const run = useCallback(
    async (settings: CaptureSettings) => {
      if (!driver) {
        setStatus({ phase: "error", message: "No machine detected." });
        return;
      }
      setStems([]);
      const capture = new StemCapture(midi, recorder, driver);
      try {
        const result = await capture.run(settings, setStatus);
        setStems(result);
      } catch {
        /* status déjà mis à 'error' par StemCapture */
      }
    },
    [midi, recorder, driver]
  );

  const reset = useCallback(() => {
    setStems([]);
    setStatus({ phase: "idle" });
  }, []);

  return { status, stems, run, reset };
}

import { useCallback, useRef, useState } from "react";
import { AudioRecorder } from "../../engine/audio/AudioRecorder";
import type { AudioDeviceInfo } from "../../engine/types";

export function useAudioDevices(matchLabel?: (label: string) => boolean) {
  const recorder = useRef(new AudioRecorder());
  const [devices, setDevices] = useState<AudioDeviceInfo[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [opened, setOpened] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const list = useCallback(async () => {
    try {
      const ds = await recorder.current.listDevices();
      setDevices(ds);
      // Auto-sélection de la machine si on sait la reconnaître.
      const match = matchLabel ? ds.find((d) => matchLabel(d.label)) : undefined;
      if (match) setSelected(match.deviceId);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [matchLabel]);

  const open = useCallback(async (deviceId: string) => {
    try {
      await recorder.current.open(deviceId);
      setSelected(deviceId);
      setOpened(true);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setOpened(false);
    }
  }, []);

  return { recorder: recorder.current, devices, selected, setSelected, opened, error, list, open };
}

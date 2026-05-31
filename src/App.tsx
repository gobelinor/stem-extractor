import { useCallback, useMemo, useState } from "react";
import { useMidi } from "./ui/hooks/useMidi";
import { useAudioDevices } from "./ui/hooks/useAudioDevices";
import { useStemCapture } from "./ui/hooks/useStemCapture";
import { Panel } from "./ui/components/Panel";
import { DeviceSetup } from "./ui/components/DeviceSetup";
import { CaptureControls } from "./ui/components/CaptureControls";
import { StemList } from "./ui/components/StemList";
import type { CaptureSettings } from "./engine/types";

export default function App() {
  const { engine, state: midi, init, selectOutput, selectInput, measureBpm } = useMidi();
  const driver = midi.driver;

  const matchLabel = useMemo(
    () => (driver ? (l: string) => driver.audioDeviceMatch(l) : undefined),
    [driver]
  );
  const audio = useAudioDevices(matchLabel);
  const capture = useStemCapture(engine, audio.recorder, driver);

  const [settings, setSettings] = useState<CaptureSettings>({
    projectName: "my-project",
    bpm: 120,
    bars: 8,
    latencyOffsetMs: 0,
    tailSec: 3,
  });

  // Un seul geste utilisateur : autorise MIDI et liste les devices audio.
  const onInit = useCallback(async () => {
    await init();
    await audio.list();
  }, [init, audio]);

  const onSelectAudio = useCallback(
    (id: string) => {
      audio.setSelected(id);
      void audio.open(id); // ouverture sur geste utilisateur (AudioContext)
    },
    [audio]
  );

  const ready = midi.ready && !!midi.selectedOutput;
  const canCapture = ready && audio.opened && !!driver;

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-10">
        <h1 className="text-2xl font-semibold tracking-tight">Stem Extractor</h1>
        <p className="mt-1 text-sm text-[var(--color-mute)]">
          Plug your device over USB · MIDI solo track by track · aligned WAV stems.
        </p>
        <p className="mt-1 text-xs text-[var(--color-mute)]">Currently supports the OP-XY only.</p>
      </header>

      <div className="space-y-5">
        <Panel step={1} title="Setup" hint="MIDI + audio" active>
          <DeviceSetup
            midi={midi}
            onInit={onInit}
            onSelectOutput={selectOutput}
            onSelectInput={selectInput}
            audioDevices={audio.devices}
            audioSelected={audio.selected}
            audioError={audio.error}
            onListAudio={audio.list}
            onSelectAudio={onSelectAudio}
            audioMatch={matchLabel}
          />
        </Panel>

        <Panel step={2} title="Capture" hint="8 or 16 bars" active={ready}>
          <CaptureControls
            settings={settings}
            onChange={setSettings}
            onRun={() => capture.run(settings)}
            status={capture.status}
            disabled={!canCapture}
            trackCount={driver?.trackCount ?? 8}
            onGetBpm={measureBpm}
          />
          {!audio.opened && ready && (
            <p className="mt-3 text-xs text-[var(--color-mute)]">
              Select the device audio output to enable capture.
            </p>
          )}
        </Panel>

        <Panel step={3} title="Stems" active={capture.stems.length > 0}>
          <StemList
            stems={capture.stems}
            driverName={driver?.name ?? ""}
            projectName={settings.projectName}
          />
        </Panel>
      </div>

      <footer className="mt-12 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--color-mute)]">
        <span>Chrome / Edge required (Web MIDI).</span>
        <span className="flex shrink-0 items-center gap-3">
          <a
            href="https://github.com/gobelinor/stem-extractor/issues/new/choose"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-[var(--color-accent)]"
          >
            request a feature
          </a>
          <span aria-hidden>·</span>
          <a
            href="https://ko-fi.com/thankyoufriend"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-[var(--color-accent)]"
          >
            ☕ buy me a coffee
          </a>
        </span>
      </footer>
    </div>
  );
}

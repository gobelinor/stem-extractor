import type { MidiState } from "../hooks/useMidi";
import type { AudioDeviceInfo, MidiPortInfo } from "../../engine/types";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs uppercase tracking-wide text-[var(--color-mute)]">
        {label}
      </span>
      {children}
    </label>
  );
}

const selectCls =
  "w-full rounded-lg border border-[var(--color-edge)] bg-[var(--color-ink)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]";

function PortSelect({
  value,
  ports,
  onChange,
}: {
  value: string | null;
  ports: MidiPortInfo[];
  onChange: (id: string) => void;
}) {
  return (
    <select className={selectCls} value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
      <option value="" disabled>
        — select —
      </option>
      {ports.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  );
}

export function DeviceSetup({
  midi,
  onInit,
  onSelectOutput,
  onSelectInput,
  audioDevices,
  audioSelected,
  audioError,
  onListAudio,
  onSelectAudio,
  audioMatch,
}: {
  midi: MidiState;
  onInit: () => void;
  onSelectOutput: (id: string) => void;
  onSelectInput: (id: string) => void;
  audioDevices: AudioDeviceInfo[];
  audioSelected: string | null;
  audioError: string | null;
  onListAudio: () => void;
  onSelectAudio: (id: string) => void;
  audioMatch?: (label: string) => boolean;
}) {
  if (!midi.supported) {
    return (
      <p className="text-sm text-red-400">
        Web MIDI is not supported. Open the app in <b>Chrome</b> or <b>Edge</b> (Safari is not
        compatible).
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {!midi.ready ? (
        <button
          onClick={onInit}
          className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-black hover:opacity-90"
        >
          Enable MIDI &amp; audio
        </button>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="MIDI out (to device)">
            <PortSelect value={midi.selectedOutput} ports={midi.outputs} onChange={onSelectOutput} />
          </Field>
          <Field label="MIDI in (diagnostic)">
            <PortSelect value={midi.selectedInput} ports={midi.inputs} onChange={onSelectInput} />
          </Field>
          <Field label="Audio device (device output)">
            <div className="flex gap-2">
              <select
                className={selectCls}
                value={audioSelected ?? ""}
                onChange={(e) => onSelectAudio(e.target.value)}
              >
                <option value="" disabled>
                  — select —
                </option>
                {audioDevices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label}
                  </option>
                ))}
              </select>
              <button
                onClick={onListAudio}
                className="shrink-0 rounded-lg border border-[var(--color-edge)] px-3 text-sm hover:border-[var(--color-accent)]"
              >
                List
              </button>
            </div>
          </Field>
          <div className="flex items-end">
            <div className="text-sm">
              <span className="text-[var(--color-mute)]">Detected device: </span>
              <span className="font-medium text-[var(--color-accent)]">
                {midi.driver?.name ?? "none"}
              </span>
            </div>
          </div>
        </div>
      )}

      {midi.ready && midi.driver && (
        <div className="rounded-lg border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/5 p-4 text-sm">
          <p className="font-medium text-[var(--color-accent)]">
            {midi.driver.name} detected — enable MIDI receive on the device
          </p>
          <p className="mt-1.5 text-[var(--color-mute)]">
            On the OP-XY:{" "}
            <code className="text-[#ededf0]">COM → system → midi</code>, then set{" "}
            <code className="text-[#ededf0]">clock</code> to{" "}
            <code className="text-[#ededf0]">both</code> and enable{" "}
            <code className="text-[#ededf0]">midi IN</code>. Otherwise the OP-XY won’t follow the
            app’s clock or the solo (CC9). “both” also lets Get BPM read the clock.
          </p>
        </div>
      )}

      {midi.error && <p className="text-sm text-red-400">{midi.error}</p>}
      {audioError && <p className="text-sm text-red-400">{audioError}</p>}

      {midi.ready && (
        <DiagnosticLog log={midi.log} clockTicks={midi.clockTicks} audioMatch={audioMatch} />
      )}
    </div>
  );
}

function DiagnosticLog({
  log,
  clockTicks,
}: {
  log: string[];
  clockTicks: number;
  audioMatch?: (label: string) => boolean;
}) {
  return (
    <details className="rounded-lg border border-[var(--color-edge)] p-3 text-sm">
      <summary className="cursor-pointer text-[var(--color-mute)]">
        Incoming MIDI diagnostic ·{" "}
        {clockTicks > 0 ? `clock ✓ (${clockTicks} ticks)` : "no clock"}
      </summary>
      <pre className="mt-2 max-h-40 overflow-auto font-mono text-xs text-[var(--color-mute)]">
        {log.length ? log.join("\n") : "—"}
      </pre>
    </details>
  );
}

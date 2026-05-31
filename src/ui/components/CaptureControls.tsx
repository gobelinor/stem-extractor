import { useState } from "react";
import type { BarLength, CaptureSettings, CaptureStatus } from "../../engine/types";
import { slugify } from "../../engine/io/naming";

const barOptions: BarLength[] = [8, 16];
const inputCls =
  "w-full rounded-lg border border-[var(--color-edge)] bg-[var(--color-ink)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]";
const labelCls = "mb-1.5 block text-xs uppercase tracking-wide text-[var(--color-mute)]";

export function CaptureControls({
  settings,
  onChange,
  onRun,
  status,
  disabled,
  trackCount,
  onGetBpm,
}: {
  settings: CaptureSettings;
  onChange: (s: CaptureSettings) => void;
  onRun: () => void;
  status: CaptureStatus;
  disabled: boolean;
  trackCount: number;
  onGetBpm: () => Promise<number>;
}) {
  const running = status.phase === "running";
  const [measuring, setMeasuring] = useState(false);
  const [bpmHint, setBpmHint] = useState<string | null>(null);

  const getBpm = async () => {
    setMeasuring(true);
    setBpmHint("Start playback on the device (clock OUT enabled)…");
    try {
      const bpm = await onGetBpm();
      // Snap to integer when very close, otherwise round to 0.1.
      const snapped =
        Math.abs(bpm - Math.round(bpm)) < 0.2 ? Math.round(bpm) : Math.round(bpm * 10) / 10;
      onChange({ ...settings, bpm: snapped });
      setBpmHint(null);
    } catch (e) {
      setBpmHint(e instanceof Error ? e.message : String(e));
    } finally {
      setMeasuring(false);
    }
  };

  return (
    <div className="space-y-5">
      <label className="block">
        <span className={labelCls}>Project name</span>
        <input
          type="text"
          value={settings.projectName}
          placeholder="my-track"
          onChange={(e) => onChange({ ...settings, projectName: e.target.value })}
          className={inputCls}
        />
        <span className="mt-1 block text-xs text-[var(--color-mute)]">
          stems named: <code>{slugify(settings.projectName)}_{settings.bpm}bpm_01.wav</code>
        </span>
      </label>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <span className={labelCls}>Length</span>
          <div className="flex gap-2">
            {barOptions.map((b) => (
              <button
                key={b}
                onClick={() => onChange({ ...settings, bars: b })}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm transition ${
                  settings.bars === b
                    ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                    : "border-[var(--color-edge)] hover:border-[var(--color-mute)]"
                }`}
              >
                {b} bars
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className={labelCls}>BPM</span>
          <div className="flex gap-2">
            <input
              type="number"
              value={settings.bpm}
              min={20}
              max={300}
              step={0.1}
              onChange={(e) => onChange({ ...settings, bpm: Number(e.target.value) })}
              className={inputCls}
            />
            <button
              onClick={getBpm}
              disabled={measuring || running}
              title="Measure BPM from incoming MIDI clock"
              className="shrink-0 rounded-lg border border-[var(--color-edge)] px-3 text-sm hover:border-[var(--color-accent)] disabled:opacity-40"
            >
              {measuring ? "…" : "Get BPM"}
            </button>
          </div>
          {bpmHint && <span className="mt-1 block text-xs text-[var(--color-mute)]">{bpmHint}</span>}
        </div>

      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <NumberField
          label="Tail (s)"
          value={settings.tailSec}
          min={0}
          max={30}
          step={0.5}
          onChange={(tailSec) => onChange({ ...settings, tailSec })}
        />
        <NumberField
          label="Latency (ms)"
          value={settings.latencyOffsetMs}
          min={0}
          max={500}
          step={1}
          onChange={(latencyOffsetMs) => onChange({ ...settings, latencyOffsetMs })}
        />
      </div>

      <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-300/90">
        Check first: with all tracks muted and the sequencer running, nothing should play. Any
        bleed-through ends up in every stem.
      </p>

      <div className="flex items-center gap-4">
        <button
          onClick={onRun}
          disabled={disabled || running}
          className="rounded-lg bg-[var(--color-accent)] px-5 py-2.5 text-sm font-medium text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
        >
          {running ? "Capturing…" : `Capture ${trackCount} stems`}
        </button>
        {running && (
          <span className="text-sm text-[var(--color-mute)]">
            track {status.track}/{status.total}
          </span>
        )}
        {status.phase === "error" && <span className="text-sm text-red-400">{status.message}</span>}
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className={inputCls}
      />
    </label>
  );
}

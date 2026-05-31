import { useEffect, useState } from "react";
import type { CaptureSettings, CaptureStatus } from "../../engine/types";
import { slugify } from "../../engine/io/naming";

const barPresets = [8, 16, 32, 64];
const MAX_BARS = 512;

function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return m > 0 ? `${m}:${String(s).padStart(2, "0")}` : `${s}s`;
}
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

  // Champ bars libre : on garde un état texte pour autoriser la case vide pendant
  // la saisie (sinon un 1 se réinsère dès qu'on efface). On commit un nombre clampé.
  const [barsText, setBarsText] = useState(String(settings.bars));
  useEffect(() => setBarsText(String(settings.bars)), [settings.bars]);
  const onBarsInput = (v: string) => {
    if (v !== "" && !/^\d+$/.test(v)) return; // chiffres uniquement
    setBarsText(v);
    if (v === "") return; // case vide tolérée, pas de commit
    onChange({ ...settings, bars: Math.max(1, Math.min(MAX_BARS, Number(v))) });
  };

  const allTracks = Array.from({ length: trackCount }, (_, i) => i + 1);
  const enabledCount = allTracks.filter((t) => !settings.disabledTracks.includes(t)).length;
  const perStemSec = (settings.bars * 4 * 60) / settings.bpm + settings.tailSec;
  const totalSec = perStemSec * enabledCount;
  const heavyCapture = totalSec > 360; // ~6 min total → mémoire/temps notables
  const toggleTrack = (t: number) => {
    const disabled = settings.disabledTracks.includes(t)
      ? settings.disabledTracks.filter((x) => x !== t)
      : [...settings.disabledTracks, t];
    onChange({ ...settings, disabledTracks: disabled });
  };

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

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className={labelCls}>Tracks</span>
          <span className="text-xs text-[var(--color-mute)]">
            <button onClick={() => onChange({ ...settings, disabledTracks: [] })} className="hover:text-[var(--color-accent)]">
              all
            </button>{" "}
            ·{" "}
            <button onClick={() => onChange({ ...settings, disabledTracks: allTracks })} className="hover:text-[var(--color-accent)]">
              none
            </button>
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {allTracks.map((t) => {
            const on = !settings.disabledTracks.includes(t);
            return (
              <button
                key={t}
                onClick={() => toggleTrack(t)}
                aria-pressed={on}
                className={`h-9 w-9 rounded-lg border text-sm tabular-nums transition ${
                  on
                    ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                    : "border-[var(--color-edge)] text-[var(--color-mute)] hover:border-[var(--color-mute)]"
                }`}
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <span className={labelCls}>Length (bars)</span>
          <div className="flex gap-2">
            <input
              type="text"
              inputMode="numeric"
              value={barsText}
              onChange={(e) => onBarsInput(e.target.value)}
              onBlur={() => setBarsText(String(settings.bars))}
              className={inputCls}
            />
            {barPresets.map((b) => (
              <button
                key={b}
                onClick={() => onChange({ ...settings, bars: b })}
                className={`shrink-0 rounded-lg border px-3 text-sm transition ${
                  settings.bars === b
                    ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                    : "border-[var(--color-edge)] hover:border-[var(--color-mute)]"
                }`}
              >
                {b}
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

      <div className="text-xs text-[var(--color-mute)]">
        ≈ {fmtDuration(perStemSec)} per stem · ~{fmtDuration(totalSec)} total
        {heavyCapture && (
          <span className="text-amber-300/90">
            {" "}
            — long capture, keep an eye on memory (stems are held in RAM until downloaded)
          </span>
        )}
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={onRun}
          disabled={disabled || running || enabledCount === 0}
          className="rounded-lg bg-[var(--color-accent)] px-5 py-2.5 text-sm font-medium text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
        >
          {running ? "Capturing…" : `Capture ${enabledCount} stem${enabledCount === 1 ? "" : "s"}`}
        </button>
        {running && (
          <span className="text-sm text-[var(--color-mute)]">
            track {status.track} · {status.index}/{status.total}
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

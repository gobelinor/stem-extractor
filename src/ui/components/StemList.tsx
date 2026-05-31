import { useEffect, useRef, useState } from "react";
import type { Stem } from "../../engine/types";
import { downloadAll, supportsDirectoryPicker } from "../../engine/io/download";

export function StemList({
  stems,
  driverName,
  projectName,
}: {
  stems: Stem[];
  driverName: string;
  projectName: string;
}) {
  const [busy, setBusy] = useState(false);

  if (stems.length === 0) {
    return <p className="text-sm text-[var(--color-mute)]">Stems will appear here.</p>;
  }

  const onDownloadAll = async () => {
    setBusy(true);
    try {
      await downloadAll(stems, projectName);
    } catch {
      /* annulé par l'utilisateur */
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-[var(--color-mute)]">
          {stems.length} stems · {driverName}
        </p>
        <button
          onClick={onDownloadAll}
          disabled={busy}
          className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-black hover:opacity-90 disabled:opacity-40"
        >
          {busy ? "Downloading…" : "Download all"}
        </button>
      </div>
      {!supportsDirectoryPicker() && (
        <p className="pb-1 text-xs text-[var(--color-mute)]">
          (this browser has no folder picker: WAV files will download one by one)
        </p>
      )}
      {stems.map((s) => (
        <StemRow key={s.track} stem={s} />
      ))}
    </div>
  );
}

function StemRow({ stem }: { stem: Stem }) {
  return (
    <div className="flex items-center gap-4 rounded-lg border border-[var(--color-edge)] bg-[var(--color-ink)] p-3">
      <span className="w-16 shrink-0 font-mono text-xs text-[var(--color-mute)]">
        {String(stem.track).padStart(2, "0")}
      </span>
      <Waveform blob={stem.blob} />
      <span className="shrink-0 text-xs tabular-nums text-[var(--color-mute)]">
        {stem.durationSec.toFixed(1)}s
      </span>
      <audio src={stem.url} controls className="h-8 w-44 shrink-0" />
      <a
        href={stem.url}
        download={stem.name}
        className="shrink-0 rounded-md border border-[var(--color-edge)] px-3 py-1.5 text-xs hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
      >
        WAV
      </a>
    </div>
  );
}

function Waveform({ blob }: { blob: Blob }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const buf = await blob.arrayBuffer();
      const ctx = new AudioContext();
      const audio = await ctx.decodeAudioData(buf.slice(0));
      await ctx.close();
      if (cancelled) return;
      draw(canvasRef.current, audio.getChannelData(0));
    })();
    return () => {
      cancelled = true;
    };
  }, [blob]);

  return <canvas ref={canvasRef} width={240} height={36} className="h-9 flex-1 rounded bg-black/30" />;
}

function draw(canvas: HTMLCanvasElement | null, data: Float32Array) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { width: w, height: h } = canvas;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#c7f25b";
  const mid = h / 2;
  const step = Math.max(1, Math.floor(data.length / w));
  for (let x = 0; x < w; x++) {
    let peak = 0;
    for (let i = 0; i < step; i++) peak = Math.max(peak, Math.abs(data[x * step + i] || 0));
    const barH = Math.max(1, peak * h);
    ctx.fillRect(x, mid - barH / 2, 1, barH);
  }
}

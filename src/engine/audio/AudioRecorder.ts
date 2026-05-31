import type { AudioDeviceInfo } from "../types";
import { RECORDER_PROCESSOR, recorderWorkletSource } from "./recorder-worklet";

interface Chunk {
  frame: number;
  channels: Float32Array[];
}

export interface Recording {
  sampleRate: number;
  numChannels: number;
  /** Canaux concaténés (toute la prise). */
  channels: Float32Array[];
  /** Frame absolu (currentFrame) du tout premier échantillon capturé. */
  baseFrame: number;
}

/**
 * Capture la sortie audio d'un device (interface USB de la machine) via
 * getUserMedia + AudioWorklet, sans aucun traitement navigateur. Fournit un
 * mapping performance.now() → index d'échantillon pour aligner sur l'horloge MIDI.
 */
export class AudioRecorder {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private node: AudioWorkletNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private chunks: Chunk[] = [];
  private recording = false;

  async listDevices(): Promise<AudioDeviceInfo[]> {
    // getUserMedia une 1re fois pour débloquer les labels des devices.
    try {
      const probe = await navigator.mediaDevices.getUserMedia({ audio: true });
      probe.getTracks().forEach((t) => t.stop());
    } catch {
      /* l'utilisateur refusera peut-être ; on liste quand même ce qu'on peut */
    }
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
      .filter((d) => d.kind === "audioinput")
      .map((d) => ({ deviceId: d.deviceId, label: d.label || "(device sans label)" }));
  }

  /** Ouvre le device et démarre le worklet. Aucune capture tant que start() n'est pas appelé. */
  async open(deviceId: string): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: { exact: deviceId },
        echoCancellation: false,
        autoGainControl: false,
        noiseSuppression: false,
        channelCount: 2,
      },
    });

    this.ctx = new AudioContext();
    const blobUrl = URL.createObjectURL(
      new Blob([recorderWorkletSource], { type: "application/javascript" })
    );
    await this.ctx.audioWorklet.addModule(blobUrl);
    URL.revokeObjectURL(blobUrl);

    this.source = this.ctx.createMediaStreamSource(this.stream);
    this.node = new AudioWorkletNode(this.ctx, RECORDER_PROCESSOR);
    this.node.port.onmessage = (e: MessageEvent<Chunk>) => {
      if (this.recording) this.chunks.push(e.data);
    };

    // Garde le graphe "tiré" mais silencieux (gain 0) → le worklet reçoit des blocs.
    const sink = this.ctx.createGain();
    sink.gain.value = 0;
    this.source.connect(this.node).connect(sink).connect(this.ctx.destination);

    if (this.ctx.state === "suspended") await this.ctx.resume();
  }

  get sampleRate(): number {
    return this.ctx?.sampleRate ?? 48000;
  }

  startCapture(): void {
    this.chunks = [];
    this.recording = true;
  }

  stopCapture(): Recording {
    this.recording = false;
    const sampleRate = this.sampleRate;
    if (this.chunks.length === 0) {
      return { sampleRate, numChannels: 2, channels: [new Float32Array(0), new Float32Array(0)], baseFrame: 0 };
    }
    const numChannels = this.chunks[0].channels.length;
    const baseFrame = this.chunks[0].frame;
    const total = this.chunks.reduce((n, c) => n + c.channels[0].length, 0);
    const channels = Array.from({ length: numChannels }, () => new Float32Array(total));
    let offset = 0;
    for (const chunk of this.chunks) {
      for (let c = 0; c < numChannels; c++) channels[c].set(chunk.channels[c], offset);
      offset += chunk.channels[0].length;
    }
    return { sampleRate, numChannels, channels, baseFrame };
  }

  /**
   * Mapping performance.now()(ms) → frame absolu (currentFrame), via la
   * correspondance contextTime ↔ performanceTime de l'AudioContext.
   */
  perfToFrame(perfMs: number): number {
    if (!this.ctx) return 0;
    const ots = this.ctx.getOutputTimestamp();
    const ctxTime =
      (ots.contextTime ?? this.ctx.currentTime) + (perfMs - (ots.performanceTime ?? performance.now())) / 1000;
    return Math.round(ctxTime * this.sampleRate);
  }

  /** Extrait une fenêtre [perfStart, +durationSec] de la prise. */
  extractWindow(rec: Recording, perfStartMs: number, durationSec: number): Float32Array[] {
    const startFrameAbs = this.perfToFrame(perfStartMs);
    const startIdx = Math.max(0, startFrameAbs - rec.baseFrame);
    const len = Math.round(durationSec * rec.sampleRate);
    return rec.channels.map((ch) => {
      const out = new Float32Array(len);
      out.set(ch.subarray(startIdx, Math.min(ch.length, startIdx + len)));
      return out;
    });
  }

  async close(): Promise<void> {
    this.recording = false;
    this.node?.disconnect();
    this.source?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    await this.ctx?.close();
    this.ctx = null;
    this.stream = null;
    this.node = null;
    this.source = null;
  }
}

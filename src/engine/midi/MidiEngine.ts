import type { MidiMessage, MidiPortInfo } from "../types";
import { CLOCK } from "./messages";

/**
 * Accès Web MIDI : énumère les ports, choisit une sortie/entrée, envoie des
 * messages (avec timestamp optionnel pour un scheduling précis), et permet
 * de sniffer l'entrée (diagnostic CC9 / clock).
 */
export class MidiEngine {
  private access: MIDIAccess | null = null;
  private output: MIDIOutput | null = null;
  private input: MIDIInput | null = null;
  private listeners = new Set<(msg: Uint8Array, time: number) => void>();

  get isSupported(): boolean {
    return typeof navigator !== "undefined" && "requestMIDIAccess" in navigator;
  }

  async init(): Promise<void> {
    if (!this.isSupported) {
      throw new Error("Web MIDI is not supported by this browser. Use Chrome or Edge (not Safari).");
    }
    this.access = await navigator.requestMIDIAccess({ sysex: true });
  }

  listOutputs(): MidiPortInfo[] {
    if (!this.access) return [];
    return [...this.access.outputs.values()].map(portInfo);
  }

  listInputs(): MidiPortInfo[] {
    if (!this.access) return [];
    return [...this.access.inputs.values()].map(portInfo);
  }

  get selectedOutputId(): string | null {
    return this.output?.id ?? null;
  }

  get selectedInputId(): string | null {
    return this.input?.id ?? null;
  }

  selectOutput(id: string): void {
    this.output = this.access?.outputs.get(id) ?? null;
  }

  selectInput(id: string): void {
    if (this.input) this.input.onmidimessage = null;
    this.input = this.access?.inputs.get(id) ?? null;
    if (this.input) {
      this.input.onmidimessage = (e: MIDIMessageEvent) => {
        const data = e.data;
        if (!data) return;
        for (const l of this.listeners) l(data, e.timeStamp);
      };
    }
  }

  /** Envoie un message. timestamp = DOMHighResTimeStamp (performance.now) optionnel. */
  send(msg: MidiMessage, timestamp?: number): void {
    if (!this.output) throw new Error("No MIDI output selected.");
    this.output.send(msg, timestamp);
  }

  sendMany(msgs: MidiMessage[], timestamp?: number): void {
    for (const m of msgs) this.send(m, timestamp);
  }

  onMessage(cb: (msg: Uint8Array, time: number) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  onStateChange(cb: () => void): void {
    if (this.access) this.access.onstatechange = () => cb();
  }

  /**
   * Mesure le tempo en chronométrant la MIDI clock entrante (24 ppqn). Nécessite
   * que la machine envoie sa clock (clock OUT) et joue. Médiane des intervalles
   * pour la robustesse au jitter.
   */
  measureClockBpm(opts?: { ticks?: number; timeoutMs?: number }): Promise<number> {
    const needTicks = opts?.ticks ?? 144; // ~6 noires : longue fenêtre = jitter moyenné
    const timeoutMs = opts?.timeoutMs ?? 12000;
    return new Promise((resolve, reject) => {
      const stamps: number[] = [];
      let off = () => {};
      const timer = setTimeout(() => {
        off();
        reject(
          new Error("No MIDI clock received. Enable clock OUT on the device and start playback.")
        );
      }, timeoutMs);
      off = this.onMessage((data, time) => {
        if (data[0] !== CLOCK) return;
        stamps.push(time || performance.now());
        if (stamps.length >= needTicks) {
          clearTimeout(timer);
          off();
          resolve(bpmFromStamps(stamps));
        }
      });
    });
  }
}

/**
 * Estime ms/tick par régression linéaire (moindres carrés) de index→timestamp,
 * après avoir jeté les premiers ticks (warm-up/burst au démarrage). Insensible
 * au bursting du navigateur, contrairement à une médiane des intervalles.
 */
function bpmFromStamps(stamps: number[]): number {
  const warm = Math.min(16, Math.floor(stamps.length / 4));
  const s = stamps.slice(warm);
  const n = s.length;
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    sx += i;
    sy += s[i];
    sxx += i * i;
    sxy += i * s[i];
  }
  const msPerTick = (n * sxy - sx * sy) / (n * sxx - sx * sx); // pente
  return 60000 / (msPerTick * 24);
}

function portInfo(p: MIDIPort): MidiPortInfo {
  return {
    id: p.id,
    name: p.name ?? "(sans nom)",
    manufacturer: p.manufacturer ?? "",
  };
}

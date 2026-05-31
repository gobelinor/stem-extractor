import { useCallback, useEffect, useRef, useState } from "react";
import { MidiEngine } from "../../engine/midi/MidiEngine";
import type { MidiPortInfo } from "../../engine/types";
import { matchDriverByPort } from "../../engine/machines/registry";
import type { MachineDriver } from "../../engine/machines/MachineDriver";

export interface MidiState {
  supported: boolean;
  ready: boolean;
  error: string | null;
  outputs: MidiPortInfo[];
  inputs: MidiPortInfo[];
  selectedOutput: string | null;
  selectedInput: string | null;
  driver: MachineDriver | null;
  log: string[];
  clockTicks: number;
}

function decode(data: Uint8Array): { line?: string; isClock?: boolean } {
  const status = data[0];
  if (status === 0xf8) return { isClock: true };
  if (status === 0xfa) return { line: "▶ START" };
  if (status === 0xfc) return { line: "■ STOP" };
  const type = status & 0xf0;
  const ch = (status & 0x0f) + 1;
  if (type === 0xb0) return { line: `CC${data[1]} ch${ch} = ${data[2]}` };
  if (type === 0x90 && data[2] > 0) return { line: `Note On ch${ch} ${data[1]} v${data[2]}` };
  if (type === 0x80 || type === 0x90) return { line: `Note Off ch${ch} ${data[1]}` };
  return { line: `0x${status.toString(16)}` };
}

export function useMidi() {
  const engine = useRef(new MidiEngine());
  const [state, setState] = useState<MidiState>({
    supported: engine.current.isSupported,
    ready: false,
    error: null,
    outputs: [],
    inputs: [],
    selectedOutput: null,
    selectedInput: null,
    driver: null,
    log: [],
    clockTicks: 0,
  });

  const refresh = useCallback(() => {
    const outputs = engine.current.listOutputs();
    const inputs = engine.current.listInputs();
    setState((s) => ({ ...s, outputs, inputs }));
    return { outputs, inputs };
  }, []);

  const init = useCallback(async () => {
    try {
      await engine.current.init();
      const { outputs, inputs } = refresh();
      engine.current.onStateChange(refresh);

      // Auto-sélection si l'OP-XY (ou autre machine connue) est détecté.
      const out = outputs.find((o) => matchDriverByPort(o.name));
      const inp = inputs.find((i) => matchDriverByPort(i.name));
      const driver = matchDriverByPort(out?.name ?? inp?.name ?? "") ?? null;
      if (out) engine.current.selectOutput(out.id);
      if (inp) engine.current.selectInput(inp.id);

      setState((s) => ({
        ...s,
        ready: true,
        error: null,
        selectedOutput: out?.id ?? null,
        selectedInput: inp?.id ?? null,
        driver,
      }));
    } catch (e) {
      setState((s) => ({ ...s, error: e instanceof Error ? e.message : String(e) }));
    }
  }, [refresh]);

  // Diagnostic : sniffe l'entrée MIDI sélectionnée.
  useEffect(() => {
    const off = engine.current.onMessage((data) => {
      const { line, isClock } = decode(data);
      setState((s) => {
        if (isClock) return { ...s, clockTicks: s.clockTicks + 1 };
        if (!line) return s;
        return { ...s, log: [line, ...s.log].slice(0, 30) };
      });
    });
    return off;
  }, []);

  const selectOutput = useCallback((id: string) => {
    engine.current.selectOutput(id);
    const name = engine.current.listOutputs().find((o) => o.id === id)?.name ?? "";
    setState((s) => ({ ...s, selectedOutput: id, driver: matchDriverByPort(name) ?? s.driver }));
  }, []);

  const selectInput = useCallback((id: string) => {
    engine.current.selectInput(id);
    setState((s) => ({ ...s, selectedInput: id }));
  }, []);

  const measureBpm = useCallback(() => engine.current.measureClockBpm(), []);

  return { engine: engine.current, state, init, selectOutput, selectInput, measureBpm };
}

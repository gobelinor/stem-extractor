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

  /**
   * (Re)sélectionne les ports de la machine connue UNIQUEMENT si la sélection
   * courante est absente ou a disparu de la liste. Ne vole jamais une sélection
   * valide existante (manuelle ou auto). Rejouée sur statechange → gère le
   * branchement à chaud et l'énumération tardive après un reload.
   */
  const autoSelect = useCallback((outputs: MidiPortInfo[], inputs: MidiPortInfo[]) => {
    const eng = engine.current;

    const outValid = !!eng.selectedOutputId && outputs.some((o) => o.id === eng.selectedOutputId);
    if (!outValid) {
      const out = outputs.find((o) => matchDriverByPort(o.name));
      if (out) eng.selectOutput(out.id);
    }

    const inValid = !!eng.selectedInputId && inputs.some((i) => i.id === eng.selectedInputId);
    if (!inValid) {
      const inp = inputs.find((i) => matchDriverByPort(i.name));
      if (inp) eng.selectInput(inp.id); // (re)attache le handler onmidimessage
    }

    const selName =
      outputs.find((o) => o.id === eng.selectedOutputId)?.name ??
      inputs.find((i) => i.id === eng.selectedInputId)?.name ??
      "";
    setState((s) => ({
      ...s,
      selectedOutput: eng.selectedOutputId,
      selectedInput: eng.selectedInputId,
      driver: matchDriverByPort(selName) ?? s.driver,
    }));
  }, []);

  const init = useCallback(async () => {
    try {
      await engine.current.init();
      const { outputs, inputs } = refresh();
      // Sur tout changement d'état des ports (branchement, reconnexion,
      // énumération tardive), on rafraîchit la liste ET on re-tente la sélection.
      engine.current.onStateChange(() => {
        const lists = refresh();
        autoSelect(lists.outputs, lists.inputs);
      });
      autoSelect(outputs, inputs);
      setState((s) => ({ ...s, ready: true, error: null }));
    } catch (e) {
      setState((s) => ({ ...s, error: e instanceof Error ? e.message : String(e) }));
    }
  }, [refresh, autoSelect]);

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

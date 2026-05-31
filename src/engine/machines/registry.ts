import type { MachineDriver } from "./MachineDriver";
import { opXyDriver } from "./op-xy";

// Ajouter une machine = importer son driver et l'ajouter ici.
export const drivers: MachineDriver[] = [opXyDriver];

export function findDriverById(id: string): MachineDriver | undefined {
  return drivers.find((d) => d.id === id);
}

/** Devine la machine branchée d'après un nom de port MIDI. */
export function matchDriverByPort(portName: string): MachineDriver | undefined {
  return drivers.find((d) => d.midiPortMatch(portName));
}

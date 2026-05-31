import type { MachineDriver } from "./MachineDriver";
import { cc, CC_MUTE } from "../midi/messages";

const TRACK_COUNT = 8; // 8 pistes = canaux MIDI 1..8

/**
 * Driver Teenage Engineering OP-XY.
 * Mute par piste = CC9 (0 = unmute, 1-127 = mute), une piste par canal MIDI.
 * Pas de Solo natif → on le reconstruit (cible unmute, autres mute).
 */
export const opXyDriver: MachineDriver = {
  id: "op-xy",
  name: "OP-XY",
  trackCount: TRACK_COUNT,

  midiPortMatch: (name) => /op.?xy/i.test(name),
  audioDeviceMatch: (label) => /op.?xy/i.test(label),

  trackLabel: (track) => `Track ${track}`,

  soloTrack(track) {
    const msgs = [];
    for (let ch = 1; ch <= TRACK_COUNT; ch++) {
      msgs.push(cc(ch, CC_MUTE, ch === track ? 0 : 127));
    }
    return msgs;
  },

  unmuteAll() {
    const msgs = [];
    for (let ch = 1; ch <= TRACK_COUNT; ch++) msgs.push(cc(ch, CC_MUTE, 0));
    return msgs;
  },
};

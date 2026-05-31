import type { MidiMessage } from "../types";

// Status bytes
export const NOTE_OFF = 0x80;
export const NOTE_ON = 0x90;
export const CONTROL_CHANGE = 0xb0;

// System real-time (canal indépendant)
export const CLOCK = 0xf8;
export const START = 0xfa;
export const CONTINUE = 0xfb;
export const STOP = 0xfc;

// Control Change utiles OP-XY (mais génériques)
export const CC_MUTE = 9; // 0 = unmute, 1-127 = mute
export const CC_VOLUME = 7;
export const CC_PAN = 10;

/** channel: 1-16 (humain) → nibble 0-15. */
export function cc(channel: number, controller: number, value: number): MidiMessage {
  return [CONTROL_CHANGE | (channel - 1), controller & 0x7f, value & 0x7f];
}

export const clockTick: MidiMessage = [CLOCK];
export const startMsg: MidiMessage = [START];
export const stopMsg: MidiMessage = [STOP];
export const continueMsg: MidiMessage = [CONTINUE];

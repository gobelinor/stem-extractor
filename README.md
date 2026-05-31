<h1 align="center">🎛️ Stem Extractor</h1>

<p align="center"><b>Pull aligned per-track WAV stems out of your hardware — straight from the browser.</b></p>

<p align="center">
  <a href="https://stem-extractor.pages.dev"><b>▶ Try it</b></a> ·
  <a href="#how-it-works">How it works</a> ·
  <a href="https://github.com/gobelinor/stem-extractor/issues/new/choose">Request a machine</a>
</p>

<p align="center">
  <a href="https://stem-extractor.pages.dev"><img src="docs/demo.gif" alt="Stem Extractor demo — solo each track, record, aligned WAV stems" width="720"></a>
</p>

Most grooveboxes only expose a **stereo** master over USB — there's no multitrack audio out, so
getting stems means soloing each track by hand, recording, and repeating. Stem Extractor automates
the whole thing.

- 🎚️ **Solo + record, automated** — it solos each track over MIDI and records the stereo output, one track at a time.
- 🎯 **Sample-aligned** — the app drives the clock, so every stem lines up. Drop them into your DAW and they're perfectly in time.
- 🔒 **Local & free** — runs entirely in your browser, audio never leaves your machine, no signup, open-source.

> **Currently supports the OP-XY.** Other machines are easy to add — see
> [Add a machine](#add-a-machine). Requests welcome via
> [issues](https://github.com/gobelinor/stem-extractor/issues/new/choose).

## How it works

1. **MIDI solo** — for each track, the app mutes every other track (the OP-XY exposes mute on
   `CC9`, one track per MIDI channel) so only the target plays.
2. **App is the clock master** — it sends MIDI Start + clock (24 ppqn) + Stop, so it knows the
   exact musical window. The machine follows the external clock.
3. **Audio capture** — the machine's stereo USB output is recorded through `getUserMedia` + an
   AudioWorklet (no browser processing), then encoded to lossless WAV.
4. **Tail** — recording continues a few extra seconds after the bars so reverb/pad tails ring out
   instead of being cut.

Everything runs client-side; audio never leaves your machine.

## Run

```bash
npm install
npm run dev
# open http://localhost:5173 in Chrome or Edge (Safari has no Web MIDI)
```

## OP-XY setup

1. Connect over USB-C.
2. **Enable USB audio output** so the OP-XY shows up as an audio device.
3. `COM → system → midi`: set **clock** to **both** and enable **midi IN** — so it follows the
   app's clock and the solo (CC9). "both" also lets **Get BPM** read the project tempo.

> ⚠️ Before exporting, check on the device: with all tracks muted and the sequencer running,
> nothing should still play. Anything that bleeds through the mutes (a looping bass, a held note)
> ends up in every stem. Isolation uses **mute only** — the app never touches your volumes or mix.

## Architecture

```
src/engine/   framework-agnostic TypeScript (no React)
  midi/       MidiEngine, ClockMaster (app = master), messages
  audio/      AudioRecorder (getUserMedia + AudioWorklet), wav-encoder
  capture/    StemCapture (loop: solo → record → encode)
  machines/   MachineDriver (interface) + op-xy.ts + registry
  io/         naming, download
src/ui/       React + Tailwind (hooks + components)
```

The engine is fully decoupled from the UI: all the hard parts (MIDI, audio, WAV, sync) are plain
TypeScript, so the framework only renders.

## Add a machine

A machine is one file implementing the `MachineDriver` interface
(`src/engine/machines/MachineDriver.ts`):

```ts
export interface MachineDriver {
  id: string;
  name: string;
  trackCount: number;
  midiPortMatch(name: string): boolean;     // recognise the MIDI port by name
  audioDeviceMatch(label: string): boolean; // recognise the audio device by label
  trackLabel(track: number): string;
  soloTrack(track: number): MidiMessage[];  // target audible, others muted
  unmuteAll(): MidiMessage[];               // reset
}
```

Then register it in `src/engine/machines/registry.ts`. The rest of the engine (clock, capture, WAV)
doesn't change. See `src/engine/machines/op-xy.ts` for a reference implementation.

Don't have time to code it? Open a
[machine support request](https://github.com/gobelinor/stem-extractor/issues/new/choose) with the
machine's MIDI implementation and it can be added.

## Roadmap

- Batch export across **all projects** on the device (the OP-XY exposes a `project` CC).
- More machine drivers (community-driven).
- Stem management / DAW handoff.

## Limitations

- Chrome / Edge only (Web MIDI).
- Stereo capture (no multitrack USB — hence the solo approach).

## Support

Stem Extractor is free and open. If it saved you time, you can
[buy me a coffee](https://ko-fi.com/thankyoufriend) ☕ — entirely optional.

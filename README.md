<h1 align="center">🎛️ Stem Extractor</h1>

<p align="center"><b>Pull aligned per-track WAV stems out of your hardware — straight from the browser.</b></p>

<p align="center">
  <a href="https://stem-extractor.pages.dev"><b>▶ Try it</b></a> ·
  <a href="#setup-op-xy">Setup</a> ·
  <a href="https://github.com/gobelinor/stem-extractor/issues/new/choose">Request a machine</a>
</p>

<p align="center">
  <a href="https://stem-extractor.pages.dev"><img src="docs/demo.gif" alt="Stem Extractor demo — solo each track, record, aligned WAV stems" width="720"></a>
</p>

Grooveboxes only send a **stereo** master over USB — no multitrack out. So getting stems means
soloing each track by hand, recording, and repeating. Stem Extractor automates it: it solos each
track over MIDI, records the stereo output, and gives you one **sample-aligned** WAV per track —
drop them into your DAW and they're in time.

- 🎚️ Automated solo + record, one track at a time
- 🎯 Sample-aligned (the app drives the MIDI clock)
- 🔒 Runs in your browser, audio stays local, no signup

> **OP-XY only for now.** Other machines are one file to add — [request one](https://github.com/gobelinor/stem-extractor/issues/new/choose).

## Run

```bash
npm install
npm run dev   # http://localhost:5173 in Chrome/Edge (no Safari)
```

Live: **https://stem-extractor.pages.dev**

## Setup (OP-XY)

1. Connect over USB-C and **enable USB audio output**.
2. `COM → system → midi`: set **clock** to **both**, enable **midi IN**.
3. In the app, pick the MIDI + audio device, choose bars / BPM, and capture.

> Before exporting, check on the device: with all tracks muted and the sequencer running, nothing
> should still play — anything that bleeds through the mutes ends up in every stem. Isolation uses
> mute only; the app never touches your mix.

## Add a machine

A machine is one file implementing `MachineDriver`
(`src/engine/machines/MachineDriver.ts`) — mainly `soloTrack()` and `unmuteAll()` — registered in
`registry.ts`. See `op-xy.ts` for reference. No time to code? Open a
[machine support request](https://github.com/gobelinor/stem-extractor/issues/new/choose).

## License

Source-available under the [PolyForm Noncommercial License](LICENSE.md): free to use, modify, and
share for **noncommercial** purposes. You can't sell it or bundle it into a paid product.

## Support

Free for personal use. If it saved you time, [buy me a coffee](https://ko-fi.com/thankyoufriend) ☕.

# Stem Extractor — POC

Web app : branche une machine à musique en USB (MVP = **OP-XY**), isole chaque piste en
MIDI (solo), enregistre la sortie audio stéréo piste par piste, et produit un set de
**stems WAV** alignés.

## Lancer

```bash
npm install
npm run dev
# ouvrir http://localhost:5173 dans Chrome ou Edge (pas Safari : pas de Web MIDI)
```

## Pré-requis côté OP-XY

1. Branché en USB-C.
2. **Sortie USB audio activée** (la machine doit apparaître comme device audio).
3. **Clock externe** : l'app est l'horloge maître (elle envoie Start + MIDI clock + Stop).

## Utilisation

1. **Setup** → « Autoriser MIDI & audio », puis choisir la sortie MIDI, l'entrée MIDI
   (diagnostic) et le device audio de la machine. L'OP-XY est auto-détecté.
2. **Capture** → choisir 8 / 16 bars, le BPM, l'offset de latence, puis lancer.
   L'app boucle sur les 8 pistes : solo (CC9) → lecture N bars → enregistrement.
3. **Stems** → un WAV par piste, écoute + download.

## Calibration latence

`Latence (ms)` compense le délai entre l'envoi du Start MIDI et l'arrivée de l'audio USB.
Si les stems sont en avance/retard, ajuster (typiquement quelques dizaines de ms).

## Architecture

```
src/engine/   TS pur, agnostique UI
  midi/       MidiEngine, ClockMaster (app = master), messages
  audio/      AudioRecorder (getUserMedia + AudioWorklet), wav-encoder
  capture/    StemCapture (boucle solo → record → encode)
  machines/   MachineDriver (interface) + op-xy.ts + registry
src/ui/       React + Tailwind (hooks + composants)
```

**Ajouter une machine** = un fichier dans `engine/machines/` implémentant `MachineDriver`,
ajouté au `registry`. Le cœur (clock, capture, WAV) ne change pas.

## Limites (POC)

- Chrome / Edge uniquement (Web MIDI).
- Sortie stéréo (pas de multitrack USB — d'où l'approche solo).
- Pas d'auth / stockage / normalisation / zip (étapes suivantes).

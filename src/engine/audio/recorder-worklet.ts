// Source de l'AudioWorkletProcessor, chargée via un Blob URL (robuste quel que
// soit le bundler). Capture les blocs Float32 de chaque canal et les poste au
// main thread, en estampillant le numéro de frame absolu (currentFrame) pour
// permettre un alignement échantillon-exact avec l'horloge MIDI.

export const RECORDER_PROCESSOR = "stem-recorder";

export const recorderWorkletSource = /* js */ `
class StemRecorder extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) return true; // garde le node vivant
    const channels = [];
    for (let c = 0; c < input.length; c++) {
      channels.push(input[c].slice()); // copie défensive
    }
    this.port.postMessage({ frame: currentFrame, channels });
    return true;
  }
}
registerProcessor(${JSON.stringify(RECORDER_PROCESSOR)}, StemRecorder);
`;

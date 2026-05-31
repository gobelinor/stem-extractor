// Nommage des stems et du dossier de projet.

export function slugify(s: string): string {
  return (
    s
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "") // accents
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "project"
  );
}

/** Ex: "ma-track_120bpm_03.wav" (nom du projet · BPM · numéro de piste). */
export function stemFileName(projectName: string, bpm: number, track: number): string {
  return `${slugify(projectName)}_${bpm}bpm_${String(track).padStart(2, "0")}.wav`;
}

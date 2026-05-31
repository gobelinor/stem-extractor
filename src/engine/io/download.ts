import type { Stem } from "../types";
import { slugify } from "./naming";

/**
 * Télécharge tous les stems d'un coup. Si le navigateur supporte la File System
 * Access API (Chrome/Edge), propose de choisir un dossier et y écrit un
 * sous-dossier au nom du projet contenant tous les WAV. Sinon, fallback :
 * téléchargements individuels enchaînés.
 */
export async function downloadAll(stems: Stem[], projectName: string): Promise<void> {
  const folder = slugify(projectName);
  const picker = (window as unknown as { showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle> })
    .showDirectoryPicker;

  if (picker) {
    const root = await picker();
    const dir = await root.getDirectoryHandle(folder, { create: true });
    for (const s of stems) {
      const fileHandle = await dir.getFileHandle(s.name, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(s.blob);
      await writable.close();
    }
    return;
  }

  // Fallback : un download par stem.
  for (const s of stems) {
    const a = document.createElement("a");
    a.href = s.url;
    a.download = s.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    await new Promise((r) => setTimeout(r, 150));
  }
}

export function supportsDirectoryPicker(): boolean {
  return "showDirectoryPicker" in window;
}

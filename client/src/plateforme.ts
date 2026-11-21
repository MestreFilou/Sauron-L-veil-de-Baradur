/**
 * Ce que le client peut demander à l'application de bureau (Electron), par le
 * pont exposé dans desktop/preload.cjs. Dans un simple navigateur (npm run
 * dev), le pont n'existe pas : les sauvegardes vont dans le stockage local et
 * le plein écran passe par l'API du navigateur.
 */
export interface FichierSauvegarde {
  id: string;
  texte: string;
}

export interface PontBureau {
  sauvegardes: {
    lister(): Promise<FichierSauvegarde[]>;
    ecrire(id: string, texte: string): Promise<void>;
    effacer(id: string): Promise<void>;
    ouvrirDossier(): Promise<void>;
  };
  fenetre: {
    pleinEcran(actif: boolean): Promise<void>;
    estPleinEcran(): Promise<boolean>;
    quitter(): void;
  };
}

declare global {
  interface Window {
    sauronBureau?: PontBureau;
  }
}

export const bureau: PontBureau | undefined = typeof window !== 'undefined' ? window.sauronBureau : undefined;
export const estBureau = bureau !== undefined;

export async function basculerPleinEcran(actif: boolean): Promise<void> {
  if (bureau) return bureau.fenetre.pleinEcran(actif);
  try {
    if (actif && !document.fullscreenElement) await document.documentElement.requestFullscreen();
    if (!actif && document.fullscreenElement) await document.exitFullscreen();
  } catch {
    /* refusé par le navigateur : on reste comme on est */
  }
}

export async function estPleinEcran(): Promise<boolean> {
  if (bureau) return bureau.fenetre.estPleinEcran();
  return document.fullscreenElement !== null;
}

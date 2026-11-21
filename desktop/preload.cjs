/**
 * Le pont entre la page du jeu et l'application : seules ces quelques
 * fonctions passent, la page n'a aucun accès direct au disque ni à Node.
 * Le client les trouve dans window.sauronBureau (client/src/plateforme.ts).
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('sauronBureau', {
  sauvegardes: {
    lister: () => ipcRenderer.invoke('sauvegardes:lister'),
    ecrire: (id, texte) => ipcRenderer.invoke('sauvegardes:ecrire', id, texte),
    effacer: (id) => ipcRenderer.invoke('sauvegardes:effacer', id),
    ouvrirDossier: () => ipcRenderer.invoke('sauvegardes:dossier'),
  },
  fenetre: {
    pleinEcran: (actif) => ipcRenderer.invoke('fenetre:plein-ecran', Boolean(actif)),
    estPleinEcran: () => ipcRenderer.invoke('fenetre:est-plein-ecran'),
    quitter: () => ipcRenderer.send('app:quitter'),
  },
});

/**
 * L'application de bureau : une fenêtre Electron qui affiche le client
 * (client/dist), sans barre d'adresse ni menu, et qui s'occupe de ce qu'une
 * page web ne sait pas faire seule : écrire les sauvegardes sur le disque,
 * passer en plein écran pour de bon, quitter.
 *
 *   npm run app            construit le client et ouvre la fenêtre
 *   npm run app:dev        ouvre la fenêtre sur le serveur de dev (npm run dev à côté)
 *   npm run app:paquet     fabrique l'installeur pour ce système (desktop/dist/)
 */
const { app, BrowserWindow, ipcMain, net, protocol, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const DEV = process.argv.includes('--dev');
const URL_DEV = 'http://localhost:5173/';

/** Le client construit : copié dans l'application à l'empaquetage, lu dans client/dist sinon. */
const RACINE = app.isPackaged ? path.join(__dirname, 'jeu') : path.join(__dirname, '..', 'client', 'dist');

/**
 * Le jeu est servi par un protocole à lui (oeil://jeu/…) plutôt qu'en file:// :
 * une origine fixe (le stockage local survit aux mises à jour), des modules
 * ES et des fichiers audio qui se chargent comme sur un vrai serveur.
 */
protocol.registerSchemesAsPrivileged([
  { scheme: 'oeil', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);

const dossierSauvegardes = () => path.join(app.getPath('userData'), 'sauvegardes');
const fichierFenetre = () => path.join(app.getPath('userData'), 'fenetre.json');
const ID_VALIDE = /^[a-z0-9_-]{1,40}$/;

function lireJson(fichier, defaut) {
  try {
    return JSON.parse(fs.readFileSync(fichier, 'utf8'));
  } catch {
    return defaut;
  }
}

/** Écriture atomique : un fichier temporaire, puis un renommage (pas de sauvegarde à moitié écrite si le jeu est coupé). */
function ecrireAtomique(fichier, texte) {
  fs.mkdirSync(path.dirname(fichier), { recursive: true });
  const tmp = `${fichier}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, texte, 'utf8');
  fs.renameSync(tmp, fichier);
}

function cheminSauvegarde(id) {
  if (typeof id !== 'string' || !ID_VALIDE.test(id)) throw new Error('identifiant de sauvegarde invalide');
  return path.join(dossierSauvegardes(), `${id}.json`);
}

ipcMain.handle('sauvegardes:lister', () => {
  const dossier = dossierSauvegardes();
  if (!fs.existsSync(dossier)) return [];
  return fs
    .readdirSync(dossier)
    .filter((f) => f.endsWith('.json') && ID_VALIDE.test(f.slice(0, -5)))
    .map((f) => ({ id: f.slice(0, -5), texte: fs.readFileSync(path.join(dossier, f), 'utf8') }));
});
ipcMain.handle('sauvegardes:ecrire', (_e, id, texte) => {
  if (typeof texte !== 'string' || texte.length > 20_000_000) throw new Error('sauvegarde invalide');
  ecrireAtomique(cheminSauvegarde(id), texte);
});
ipcMain.handle('sauvegardes:effacer', (_e, id) => {
  fs.rmSync(cheminSauvegarde(id), { force: true });
});
ipcMain.handle('sauvegardes:dossier', async () => {
  fs.mkdirSync(dossierSauvegardes(), { recursive: true });
  await shell.openPath(dossierSauvegardes());
});

function creerFenetre() {
  const pref = lireJson(fichierFenetre(), {});
  const fenetre = new BrowserWindow({
    width: 1600,
    height: 900,
    minWidth: 1100,
    minHeight: 680,
    backgroundColor: '#070505',
    title: 'L’Œil de Barad-dûr',
    icon: path.join(__dirname, 'icone.png'),
    show: false,
    autoHideMenuBar: true,
    fullscreen: pref.pleinEcran === true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      // La musique de l'écran titre démarre sans attendre un clic.
      autoplayPolicy: 'no-user-gesture-required',
      spellcheck: false,
    },
  });
  fenetre.removeMenu();
  fenetre.once('ready-to-show', () => fenetre.show());

  const memoriser = () => ecrireAtomique(fichierFenetre(), JSON.stringify({ pleinEcran: fenetre.isFullScreen() }));
  fenetre.on('enter-full-screen', memoriser);
  fenetre.on('leave-full-screen', memoriser);

  // F11 : plein écran, partout (le menu Options fait la même chose).
  fenetre.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') {
      fenetre.setFullScreen(!fenetre.isFullScreen());
      e.preventDefault();
    }
    if (input.type === 'keyDown' && input.key === 'F12' && (DEV || !app.isPackaged)) fenetre.webContents.toggleDevTools();
  });

  // Le jeu ne navigue jamais ailleurs ; un lien externe s'ouvre dans le navigateur.
  fenetre.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  fenetre.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('oeil://') && !(DEV && url.startsWith(URL_DEV))) e.preventDefault();
  });

  void fenetre.loadURL(DEV ? URL_DEV : 'oeil://jeu/index.html');
  return fenetre;
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  let principale = null;
  app.on('second-instance', () => {
    if (!principale) return;
    if (principale.isMinimized()) principale.restore();
    principale.focus();
  });

  ipcMain.handle('fenetre:plein-ecran', (e, actif) => {
    BrowserWindow.fromWebContents(e.sender)?.setFullScreen(Boolean(actif));
  });
  ipcMain.handle('fenetre:est-plein-ecran', (e) => Boolean(BrowserWindow.fromWebContents(e.sender)?.isFullScreen()));
  ipcMain.on('app:quitter', () => app.quit());

  app.whenReady().then(() => {
    protocol.handle('oeil', (requete) => {
      const { pathname } = new URL(requete.url);
      const fichier = path.normalize(path.join(RACINE, decodeURIComponent(pathname)));
      if (!fichier.startsWith(RACINE)) return new Response('interdit', { status: 403 });
      return net.fetch(pathToFileURL(fichier).toString());
    });
    if (!DEV && !fs.existsSync(path.join(RACINE, 'index.html'))) {
      console.error(`Client introuvable dans ${RACINE} : lancer d'abord « npm run build ».`);
    }
    principale = creerFenetre();
  });

  app.on('window-all-closed', () => app.quit());
}

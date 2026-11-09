// Tagged in its own window (2026-11-07, Wyatt's pick; the same setup as the Airflow calculator's and
// Updraft's desktop apps). The page is the live site, so it updates itself with every release; this
// app only adds what a browser can't do: real see-through glass (Windows acrylic) behind the Mocha
// look's Window transparency, and updates to the app itself from the public tagged-releases repo.
// Windows only for now.
const { app, BrowserWindow, ipcMain, nativeTheme, session, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { autoUpdater } = require('electron-updater');

const SITE = 'https://tagged-xi.vercel.app/';
const ORIGIN = new URL(SITE).origin;
const OPEN_OUTSIDE = new Set(['http:', 'https:', 'mailto:', 'tel:', 'obsidian:', 'webcal:']);
// Mocha's Mantle (the page color in the Updraft look), shown while the window is solid.
const MANTLE = '#181825';
const TRANSPARENCY_MAX = 40;
const WEEK = 7 * 24 * 60 * 60 * 1000;

let win = null;

// ---------- Settings kept by the app (not the page): Update automatically ----------
const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');
function readSettings() {
  try {
    return { autoUpdate: true, ...JSON.parse(fs.readFileSync(settingsFile(), 'utf8')) };
  } catch {
    return { autoUpdate: true };
  }
}
function writeSettings(patch) {
  const next = { ...readSettings(), ...patch };
  try {
    fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
    fs.writeFileSync(settingsFile(), JSON.stringify(next, null, 2));
  } catch {}
  return next;
}

function openOutside(url) {
  try {
    if (OPEN_OUTSIDE.has(new URL(url).protocol)) shell.openExternal(url);
  } catch {}
}

// ---------- Window transparency (copied from Updraft's glassFor / glassOn / macVibrancy) ----------
// The page sends the percent it shows (0 when solid: another look, 0%, or reduced transparency).
function applyGlass(percent) {
  if (!win || win.isDestroyed()) return;
  const transparent = Math.max(0, Math.min(TRANSPARENCY_MAX, Number(percent) || 0)) > 0;
  try {
    if (process.platform === 'darwin') win.setVibrancy(transparent ? 'under-window' : null);
    else win.setBackgroundMaterial(transparent ? 'acrylic' : 'none');
  } catch (err) {
    console.warn(`[tagged] transparency unavailable: ${err && err.message}`);
  }
  win.setBackgroundColor(transparent ? '#00000000' : MANTLE);
}

function createWindow() {
  const mac = process.platform === 'darwin';
  // Mocha is the default look, so start the window dark and solid; the page turns glass on.
  nativeTheme.themeSource = 'dark';
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'Tagged',
    icon: path.join(__dirname, 'icon.png'),
    show: false,
    backgroundColor: MANTLE,
    backgroundMaterial: 'none',
    ...(mac ? { visualEffectState: 'active' } : {}),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true },
  });
  win.setMenu(null);
  // The page spots the app by this tag (data-native), which is what makes Window transparency show.
  win.webContents.setUserAgent(`${win.webContents.getUserAgent()} TaggedDesktop/${app.getVersion()}`);
  win.once('ready-to-show', () => win.show());
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(`${ORIGIN}/`)) return { action: 'allow' };
    openOutside(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith(`${ORIGIN}/`) || url.startsWith('file:')) return;
    // Connecting Google Calendar and other outside sign-ins happen in the regular browser.
    event.preventDefault();
    openOutside(url);
  });
  win.webContents.on('did-fail-load', (_e, code, _desc, _url, isMain) => {
    if (isMain && code !== -3) win.loadFile(path.join(__dirname, 'offline.html'));
  });
  win.on('closed', () => (win = null));
  win.loadURL(SITE);
}

// ---------- Updates (electron-updater, from github.com/TallTeezSteez/tagged-releases) ----------
// Checks when the app opens and every 7 days (unless Update automatically is off), downloads in the
// background, and installs the next time the app is closed. Check for updates in Settings always works.
let status = { state: 'idle' };
function sendStatus(next) {
  status = next;
  if (win && !win.isDestroyed()) win.webContents.send('update-status', status);
}
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.on('checking-for-update', () => sendStatus({ state: 'checking' }));
autoUpdater.on('update-not-available', () => sendStatus({ state: 'none' }));
autoUpdater.on('update-available', (info) => sendStatus({ state: 'downloading', version: info.version, percent: 0 }));
autoUpdater.on('download-progress', (p) => sendStatus({ ...status, state: 'downloading', percent: p.percent }));
autoUpdater.on('update-downloaded', (info) => sendStatus({ state: 'ready', version: info.version }));
autoUpdater.on('error', (err) => sendStatus({ state: 'error', message: String((err && err.message) || err).split('\n')[0].slice(0, 140) }));

async function checkForUpdates() {
  if (!app.isPackaged) return { state: 'error', message: 'updates only work in the installed app' };
  if (status.state === 'ready' || status.state === 'downloading') return status;
  try {
    const result = await autoUpdater.checkForUpdates();
    // When an update is found it keeps downloading; the page hears about it through update-status.
    if (result && result.isUpdateAvailable) return { state: 'downloading', version: result.updateInfo.version, percent: 0 };
    return { state: 'none' };
  } catch (err) {
    return { state: 'error', message: String((err && err.message) || err).split('\n')[0].slice(0, 140) };
  }
}
function autoCheck() {
  if (readSettings().autoUpdate) checkForUpdates();
}

// ---------- What the page can ask for (preload.js) ----------
// The page tells us when its look changes, so the window buttons match it.
ipcMain.on('theme', (_event, dark) => {
  nativeTheme.themeSource = dark ? 'dark' : 'light';
});
ipcMain.on('glass', (_event, percent) => applyGlass(percent));
ipcMain.on('retry', () => win && win.loadURL(SITE));
ipcMain.handle('check-for-updates', () => checkForUpdates());
ipcMain.handle('get-auto-update', () => readSettings().autoUpdate);
ipcMain.on('set-auto-update', (_event, on) => {
  writeSettings({ autoUpdate: !!on });
  if (on) autoCheck();
});
ipcMain.on('restart-to-update', () => {
  if (status.state === 'ready') autoUpdater.quitAndInstall();
});
ipcMain.on('app-version', (event) => {
  event.returnValue = app.getVersion();
});
ipcMain.on('update-status-sync', (event) => {
  event.returnValue = status;
});

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });
  app.whenReady().then(() => {
    session.defaultSession.setPermissionRequestHandler((_wc, permission, callback, details) => {
      const fromSite = (details.requestingUrl || '').startsWith(`${ORIGIN}/`);
      callback(fromSite && ['notifications', 'clipboard-sanitized-write', 'media'].includes(permission));
    });
    createWindow();
    autoCheck();
    setInterval(autoCheck, WEEK);
    app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow());
  });
  app.on('window-all-closed', () => process.platform !== 'darwin' && app.quit());
}

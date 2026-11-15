// RESONA desktop app (Electron).
// Serves the same files as the website through a private "resona://" protocol, so
// there is no local web server and nothing listens on localhost.
const { app, BrowserWindow, protocol, net, session, Menu, shell, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.join(__dirname, '..');                 // resona.html (the app), worklet, icons
const SMOKE = process.argv.includes('--smoke');          // build check: load, report errors, quit
const SMOKE_UPDATE = process.argv.includes('--smoke-update'); // check + download an update, report, quit
const RELEASES = 'https://github.com/dferreiramarques/resona/releases/latest';

protocol.registerSchemesAsPrivileged([{
  scheme: 'resona',
  privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true }
}]);

function createWindow() {
  const win = new BrowserWindow({
    width: 1400, height: 860, minWidth: 360, minHeight: 480,
    backgroundColor: '#04070a', autoHideMenuBar: true, title: 'RESONA', show: !SMOKE,
    icon: path.join(ROOT, 'icon-512.png'),
    webPreferences: { contextIsolation: true, sandbox: true, backgroundThrottling: false,
      preload: path.join(__dirname, 'preload.js') }
  });
  win.loadURL('resona://app/resona.html');

  // "projetor" opens a second RESONA window (same origin, synced over BroadcastChannel);
  // any other link goes to the system browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('resona://')) {
      return { action: 'allow', overrideBrowserWindowOptions: {
        width: 1280, height: 720, backgroundColor: '#04070a', autoHideMenuBar: true, title: 'RESONA — projetor',
        webPreferences: { contextIsolation: true, sandbox: true, backgroundThrottling: false } } };
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (SMOKE) {
    const errors = [];
    win.webContents.on('console-message', (e) => { if (e.level === 'error') errors.push(e.message); });
    win.webContents.on('did-fail-load', (e, code, desc) => errors.push('load failed: ' + desc));
    win.webContents.on('did-finish-load', () => setTimeout(async () => {
      const ok = await win.webContents.executeJavaScript("typeof Renderer==='function'&&!!window.resonaDesktop&&!document.getElementById('updSec').hidden&&document.title");
      const audio = await win.webContents.executeJavaScript(
        "initEngine().then(()=>JSON.stringify({ctx:ctx.state,worklet:!!worklet,crush:!!crushNode,sr:ctx.sampleRate})).catch(e=>'ERR '+e.message)");
      console.log('SMOKE title=' + ok + ' audio=' + audio + ' errors=' + JSON.stringify(errors));
      app.exit(ok && !errors.length && !String(audio).startsWith('ERR') ? 0 : 1);
    }, 2500));
  }
  return win;
}

/* ---- updates: manual only (button in the settings), never automatic ----
   Windows / Linux AppImage: download + install on restart. macOS needs a signed app to
   self-update, so there we only report the new version and open the download page. */
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;
const newer = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); } return false; };
const sendStatus = (st) => BrowserWindow.getAllWindows().forEach((w) => w.webContents.send('upd:status', st));
autoUpdater.on('download-progress', (p) => sendStatus({ state: 'downloading', percent: Math.round(p.percent) }));
autoUpdater.on('update-downloaded', (i) => sendStatus({ state: 'downloaded', version: i.version }));
autoUpdater.on('error', (e) => sendStatus({ state: 'error', message: String((e && e.message) || e).split(String.fromCharCode(10))[0] }));

ipcMain.handle('upd:version', () => app.getVersion());
ipcMain.handle('upd:check', async () => {
  if (!app.isPackaged) return { state: 'dev', version: app.getVersion() };
  try {
    const r = await autoUpdater.checkForUpdates();
    const v = r && r.updateInfo && r.updateInfo.version;
    if (v && newer(v, app.getVersion())) return { state: 'available', version: v, canInstall: process.platform !== 'darwin' };
    return { state: 'latest', version: app.getVersion() };
  } catch (e) { return { state: 'error', message: String(e.message || e).split(String.fromCharCode(10))[0] }; }
});
ipcMain.handle('upd:download', async () => {
  try { await autoUpdater.downloadUpdate(); return { ok: true }; }
  catch (e) { return { ok: false, message: String(e.message || e).split(String.fromCharCode(10))[0] }; }
});
ipcMain.handle('upd:install', () => { setImmediate(() => autoUpdater.quitAndInstall(false, true)); return true; });
ipcMain.handle('upd:open', () => shell.openExternal(RELEASES));

app.whenReady().then(() => {
  protocol.handle('resona', (req) => {
    let p = decodeURIComponent(new URL(req.url).pathname);
    if (p === '/' || p === '') p = '/resona.html';
    const file = path.normalize(path.join(ROOT, p));
    if (!file.startsWith(ROOT + path.sep)) return new Response('forbidden', { status: 403 });
    return net.fetch(pathToFileURL(file).toString());
  });
  // microphone + fullscreen for our own pages only
  const allowed = new Set(['media', 'fullscreen']);
  session.defaultSession.setPermissionRequestHandler((wc, perm, cb, details) =>
    cb(allowed.has(perm) && (details.requestingUrl || '').startsWith('resona://')));
  session.defaultSession.setPermissionCheckHandler((wc, perm, origin) =>
    allowed.has(perm) && (origin || '').startsWith('resona://'));

  Menu.setApplicationMenu(null);
  if (SMOKE_UPDATE) {                       // test path: same calls the settings button makes
    (async () => {
      autoUpdater.on('download-progress', (p) => { if (Math.round(p.percent) % 25 === 0) console.log('UPD progress ' + Math.round(p.percent) + '%'); });
      const r = await autoUpdater.checkForUpdates().catch((e) => ({ err: e.message }));
      const v = r && r.updateInfo && r.updateInfo.version;
      console.log('UPD installed=' + app.getVersion() + ' latest=' + v + ' newer=' + (v ? newer(v, app.getVersion()) : 'n/a') + (r && r.err ? ' err=' + r.err : ''));
      if (v && newer(v, app.getVersion())) { const f = await autoUpdater.downloadUpdate().catch((e) => 'ERR ' + e.message); console.log('UPD downloaded=' + JSON.stringify(f)); }
      app.exit(0);
    })();
    return;
  }
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

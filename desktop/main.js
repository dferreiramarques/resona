// RESONA desktop app (Electron).
// Serves the same files as the website through a private "resona://" protocol, so
// there is no local web server and nothing listens on localhost.
const { app, BrowserWindow, protocol, net, session, Menu, shell } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.join(__dirname, '..');                 // resona.html (the app), worklet, icons
const SMOKE = process.argv.includes('--smoke');          // build check: load, report errors, quit

protocol.registerSchemesAsPrivileged([{
  scheme: 'resona',
  privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true }
}]);

function createWindow() {
  const win = new BrowserWindow({
    width: 1400, height: 860, minWidth: 360, minHeight: 480,
    backgroundColor: '#04070a', autoHideMenuBar: true, title: 'RESONA', show: !SMOKE,
    icon: path.join(ROOT, 'icon-512.png'),
    webPreferences: { contextIsolation: true, sandbox: true, backgroundThrottling: false }
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
      const ok = await win.webContents.executeJavaScript("typeof Renderer==='function'&&document.title");
      const audio = await win.webContents.executeJavaScript(
        "initEngine().then(()=>JSON.stringify({ctx:ctx.state,worklet:!!worklet,crush:!!crushNode,sr:ctx.sampleRate})).catch(e=>'ERR '+e.message)");
      console.log('SMOKE title=' + ok + ' audio=' + audio + ' errors=' + JSON.stringify(errors));
      app.exit(ok && !errors.length && !String(audio).startsWith('ERR') ? 0 : 1);
    }, 2500));
  }
  return win;
}

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
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

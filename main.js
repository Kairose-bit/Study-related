const { app, BrowserWindow, globalShortcut } = require('electron');

let mainWindow;

app.whenReady().then(() => {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    fullscreen: false,      // Self-study requests fullscreen after its warning
    kiosk: false,            // The dashboard and tutor remain normal windows
    frame: false,           // Removes window minimize/maximize/close buttons
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile('Part_1.html');

  // ==========================================
  // CREATOR BACKDOOR SHORTCUTS
  // ==========================================

  // Developer escape hatch for testing the windowed/fullscreen host state.
  globalShortcut.register('CommandOrControl+Shift+F', () => {
    const isKiosk = mainWindow.isKiosk();
    mainWindow.setKiosk(!isKiosk);
    mainWindow.setFullScreen(!isKiosk);
  });

  mainWindow.webContents.on('ipc-message', (_event, channel) => {
    if (channel === 'enter-protected-session') {
      mainWindow.setFullScreen(true);
      mainWindow.setKiosk(true);
    }
    if (channel === 'exit-protected-session') {
      mainWindow.setKiosk(false);
      mainWindow.setFullScreen(false);
    }
  });

  // L exits the protected fullscreen session from anywhere in the desktop app.
  globalShortcut.register('L', () => {
    mainWindow.webContents.send('force-exit-self-study');
  });

  // Keep the old creator shortcut as a secondary force-quit path.
  globalShortcut.register('CommandOrControl+Shift+L', () => {
    app.quit();
  });
});

// Clean up shortcuts when quitting
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// Prevent app from closing normally via standard OS triggers
app.on('window-all-closed', (e) => {
  e.preventDefault();
});
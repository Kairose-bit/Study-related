const { app, BrowserWindow, globalShortcut } = require('electron');

let mainWindow;

app.whenReady().then(() => {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    fullscreen: true,       // Force full screen initially
    kiosk: true,            // Kiosk mode locks down OS taskbar/dock
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

  // 1. Press Ctrl + Shift + F to TOGGLE Fullscreen/Kiosk On & Off
  globalShortcut.register('CommandOrControl+Shift+F', () => {
    const isKiosk = mainWindow.isKiosk();
    mainWindow.setKiosk(!isKiosk);
    mainWindow.setFullScreen(!isKiosk);
  });

  // 2. Press Ctrl + Shift + L to completely QUIT the app
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
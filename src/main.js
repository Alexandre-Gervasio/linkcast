const {
  app,
  BrowserWindow,
  ipcMain,
  globalShortcut,
  desktopCapturer,
  session,
  clipboard,
  shell,
} = require("electron");
const path = require("path");
const fs = require("fs");
const network = require("net");
const { startServer } = require("./server");

function writableDirectory(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.accessSync(dir, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

function storagePaths() {
  if (!app.isPackaged) {
    const base = path.join(__dirname, "..");
    return { base, userData: path.join(base, "LinkCastData") };
  }

  const portableDir =
    process.env.PORTABLE_EXECUTABLE_DIR ||
    (process.platform === "linux" && process.env.APPIMAGE
      ? path.dirname(process.env.APPIMAGE)
      : null);
  if (portableDir && writableDirectory(portableDir))
    return {
      base: portableDir,
      userData: path.join(portableDir, "LinkCastData"),
    };

  const userData = app.getPath("userData");
  return { base: userData, userData };
}
const { base: BASE, userData: USER_DATA } = storagePaths();
app.setPath("userData", USER_DATA);
if (process.platform === "linux") {
  app.commandLine.appendSwitch("no-sandbox"); // AppImage em Ubuntu 24+
  app.commandLine.appendSwitch("enable-features", "WebRTCPipeWireCapturer"); // captura de tela no Wayland
}

app.on("certificate-error", (e, wc, url, err, cert, cb) => {
  if (/^(wss|https):\/\/(127\.0\.0\.1|localhost)/.test(url)) {
    e.preventDefault();
    cb(true);
  } else cb(false);
});

// Atalhos evitam conflito com os do sistema/navegador (Ctrl+Shift+R/V/M). Personalize em LinkCastData/shortcuts.json
const defKeys = {
  record: "CommandOrControl+Shift+F9",
  mute: "CommandOrControl+Shift+F10",
};
let keys = defKeys;
try {
  const saved = JSON.parse(
    fs.readFileSync(
      path.join(app.getPath("userData"), "shortcuts.json"),
      "utf8",
    ),
  );
  keys = {
    record: typeof saved.record === "string" ? saved.record : defKeys.record,
    mute: typeof saved.mute === "string" ? saved.mute : defKeys.mute,
  };
} catch {}

let win,
  net,
  rec = null;

app.whenReady().then(async () => {
  session.defaultSession.setPermissionRequestHandler((wc, p, cb) => cb(true));
  net = await startServer(8787, app.getPath("userData"));
  win = new BrowserWindow({
    width: 1400,
    height: 860,
    backgroundColor: "#12151c",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      backgroundThrottling: false,
    },
  });
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, "renderer", "index.html"));

  for (const [a, k] of Object.entries(keys)) {
    try {
      globalShortcut.register(k, () => win.webContents.send("shortcut", a));
    } catch {}
  }
});

ipcMain.handle("info", () => ({
  port: net.port,
  localPort: net.localPort,
  ip: net.ip,
  ips: net.ips,
  base: BASE,
  platform: process.platform,
  keys,
}));

ipcMain.handle("copy-link", (_, value) => {
  if (
    typeof value !== "string" ||
    value.length > 2048 ||
    !/^https?:\/\/\S+$/.test(value)
  )
    throw new Error("URL inválida para copiar.");
  clipboard.writeText(value);
});

ipcMain.handle("share-link", async (_, service, value) => {
  if (!["whatsapp", "telegram"].includes(service) || typeof value !== "string")
    throw new Error("Serviço ou URL de compartilhamento inválido.");
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    network.isIP(url.hostname) !== 4 ||
    !["/viewer.html", "/push.html"].includes(url.pathname) ||
    !Number.isInteger(Number(url.port)) ||
    Number(url.port) < 1 ||
    Number(url.port) > 65535
  )
    throw new Error("URL de compartilhamento inválida.");
  const text =
    service === "whatsapp"
      ? `https://wa.me/?text=${encodeURIComponent(url.href)}`
      : `https://t.me/share/url?url=${encodeURIComponent(url.href)}&text=${encodeURIComponent("LinkCast ao vivo")}`;
  await shell.openExternal(text);
});

ipcMain.handle("sources", async () =>
  (
    await desktopCapturer.getSources({
      types: ["screen", "window"],
      thumbnailSize: { width: 320, height: 180 },
    })
  ).map((s) => ({ id: s.id, name: s.name, thumb: s.thumbnail.toDataURL() })),
);

ipcMain.handle("rec-start", () => {
  const dir = path.join(BASE, "recordings");
  fs.mkdirSync(dir, { recursive: true });
  const f = path.join(
    dir,
    "linkcast-" + new Date().toISOString().replace(/[:.]/g, "-") + ".webm",
  );
  rec = fs.createWriteStream(f);
  return f;
});
ipcMain.handle("rec-chunk", (_, b) => {
  if (rec) rec.write(Buffer.from(b));
});
ipcMain.handle(
  "rec-stop",
  () =>
    new Promise((r) => {
      const s = rec;
      rec = null;
      if (!s) return r(null);
      s.end(() => r(s.path));
    }),
);

app.on("will-quit", () => globalShortcut.unregisterAll());
app.on("window-all-closed", () => app.quit());

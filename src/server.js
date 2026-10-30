// Servidores embutidos: HTTPS para a rede, HTTP local para OBS e WebSocket de sinalização WebRTC
const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const os = require("os");
const net = require("net");
const { WebSocketServer } = require("ws");
const selfsigned = require("selfsigned");

const WEB = path.join(__dirname, "web");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript" };

function lanIPs() {
  const found = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    for (const item of list || []) {
      if (
        item.family !== "IPv4" ||
        item.internal ||
        !net.isIPv4(item.address) ||
        item.address.startsWith("169.254.")
      )
        continue;
      if (!found.some((entry) => entry.address === item.address))
        found.push({ name, address: item.address });
    }
  }
  return found.length ? found : [{ name: "Localhost", address: "127.0.0.1" }];
}

// Certificado autoassinado (HTTPS é obrigatório para câmera no celular)
function getCert(dir, ips) {
  const f = path.join(dir, "cert.json");
  const addresses = ips.map((item) => item.address);
  try {
    const c = JSON.parse(fs.readFileSync(f, "utf8"));
    if (JSON.stringify(c.ips) === JSON.stringify(addresses)) return c;
  } catch {}
  const altNames = [
    { type: 2, value: "localhost" },
    { type: 7, ip: "127.0.0.1" },
    ...addresses
      .filter((address) => address !== "127.0.0.1")
      .map((ip) => ({ type: 7, ip })),
  ];
  const p = selfsigned.generate([{ name: "commonName", value: "linkcast" }], {
    days: 3650,
    keySize: 2048,
    algorithm: "sha256",
    extensions: [{ name: "subjectAltName", altNames }],
  });
  const c = { ips: addresses, cert: p.cert, key: p.private };
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(f, JSON.stringify(c));
  return c;
}

function startServer(port0, dataDir) {
  return new Promise((resolve, reject) => {
    const ips = lanIPs();
    const { cert, key } = getCert(dataDir, ips);
    const handler = (req, res) => {
      let p;
      try {
        p = decodeURIComponent((req.url || "/").split("?")[0]);
      } catch {
        res.writeHead(400);
        return res.end("400");
      }
      if (p === "/") p = "/viewer.html";
      const f = path.resolve(WEB, "." + p);
      if (f !== WEB && !f.startsWith(WEB + path.sep)) {
        res.writeHead(403);
        return res.end();
      }
      fs.readFile(f, (e, d) => {
        if (e) {
          res.writeHead(404);
          return res.end("404");
        }
        res.writeHead(200, {
          "Content-Type": MIME[path.extname(f)] || "application/octet-stream",
        });
        res.end(d);
      });
    };
    const server = https.createServer({ cert, key }, handler);
    const localServer = http.createServer(handler);

    const rooms = new Map();
    let n = 0;
    const room = (name) => {
      if (!rooms.has(name)) rooms.set(name, { host: null, peers: new Map() });
      return rooms.get(name);
    };
    const send = (ws, o) => {
      if (ws && ws.readyState === 1) ws.send(JSON.stringify(o));
    };
    const attachWebSocket = (target) => {
      const wsServer = new WebSocketServer({ noServer: true });
      target.on("upgrade", (req, socket, head) => {
        wsServer.handleUpgrade(req, socket, head, (ws) =>
          wsServer.emit("connection", ws, req),
        );
      });
      return wsServer;
    };
    const wsServers = [attachWebSocket(server), attachWebSocket(localServer)];

    for (const wsServer of wsServers) {
      wsServer.on("connection", (ws) => {
        ws.on("message", (raw) => {
          let m;
          try {
            m = JSON.parse(raw);
          } catch {
            return;
          }
          if (m.t === "host") {
            const r = room(m.room);
            r.host = ws;
            ws.room = m.room;
            ws.id = "host";
            r.peers.forEach((p, id) =>
              send(ws, { t: "peer", id, role: p.role }),
            );
          } else if (m.t === "join") {
            const r = room(m.room);
            ws.room = m.room;
            ws.role = m.role;
            ws.id = "p" + ++n;
            r.peers.set(ws.id, ws);
            send(ws, { t: "joined", id: ws.id });
            send(r.host, { t: "peer", id: ws.id, role: m.role });
          } else if (m.t === "signal") {
            const r = rooms.get(ws.room);
            if (!r) return;
            send(m.to === "host" ? r.host : r.peers.get(m.to), {
              t: "signal",
              from: ws.id,
              data: m.data,
            });
          }
        });
        ws.on("close", () => {
          const r = rooms.get(ws.room);
          if (!r) return;
          if (ws.id === "host") {
            if (r.host === ws) {
              r.host = null;
              r.peers.forEach((p) => send(p, { t: "host-gone" }));
            }
          } else {
            r.peers.delete(ws.id);
            send(r.host, { t: "gone", id: ws.id });
          }
        });
      });
    }

    function listenAvailable(target, startPort, host) {
      return new Promise((res, rej) => {
        let port = startPort;
        const attempt = () => {
          const onError = (e) => {
            target.removeListener("listening", onListening);
            if (e.code === "EADDRINUSE" && port < startPort + 10) {
              target.removeListener("error", onError);
              port++;
              attempt();
            } else rej(e);
          };
          const onListening = () => {
            target.removeListener("error", onError);
            res(port);
          };
          target.once("error", onError);
          target.once("listening", onListening);
          target.listen(port, host);
        };
        attempt();
      });
    }

    listenAvailable(server, port0, "0.0.0.0")
      .then((port) =>
        listenAvailable(localServer, port + 1, "127.0.0.1")
          .then((localPort) =>
            resolve({
              port,
              localPort,
              ip: ips[0].address,
              ips,
              close: async () => {
                for (const wsServer of wsServers) {
                  for (const client of wsServer.clients) client.terminate();
                }
                await Promise.all([
                  ...wsServers.map(
                    (wsServer) =>
                      new Promise((resolveClose) =>
                        wsServer.close(resolveClose),
                      ),
                  ),
                  ...[server, localServer].map(
                    (target) =>
                      new Promise((resolveClose, rejectClose) => {
                        if (!target.listening) return resolveClose();
                        target.close((error) =>
                          error ? rejectClose(error) : resolveClose(),
                        );
                      }),
                  ),
                ]);
              },
            }),
          )
          .catch((e) => {
            server.close();
            reject(e);
          }),
      )
      .catch(reject);
  });
}

module.exports = { startServer };

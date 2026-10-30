const $ = (id) => document.getElementById(id);
const cv = $("cv"),
  ctx = cv.getContext("2d"),
  ov = $("ov"),
  octx = ov.getContext("2d");
const [initialWidth, initialHeight] = $("res").value.split("x").map(Number);
cv.width = ov.width = initialWidth;
cv.height = ov.height = initialHeight;
const layers = [];
let sel = null,
  nid = 0;
const status = (t) => {
  $("status").textContent = t;
};

/* ---------- Áudio (mix) e stream de saída ---------- */
const actx = new AudioContext();
const dest = actx.createMediaStreamDestination();
const masterGain = actx.createGain();
masterGain.connect(dest);
const micGain = actx.createGain();
micGain.connect(masterGain);
const out = new MediaStream([
  ...cv.captureStream(60).getVideoTracks(),
  ...dest.stream.getAudioTracks(),
]);

function mixAudio(stream) {
  const a = new Audio();
  a.srcObject = stream;
  a.muted = true; // necessário para streams remotos no Chromium
  actx.createMediaStreamSource(stream).connect(masterGain);
}
navigator.mediaDevices
  .getUserMedia({ audio: true })
  .then((s) => actx.createMediaStreamSource(s).connect(micGain))
  .catch(() => status("Microfone indisponível."));

/* ---------- Camadas ---------- */
function fit(L, cover = false) {
  const vw = L.v.videoWidth || 16,
    vh = L.v.videoHeight || 9;
  const s = (cover ? Math.max : Math.min)(cv.width / vw, cv.height / vh);
  L.w = vw * s;
  L.h = vh * s;
  L.x = (cv.width - L.w) / 2;
  L.y = (cv.height - L.h) / 2;
}
function addLayer(name, stream) {
  const v = document.createElement("video");
  v.srcObject = stream;
  v.muted = true;
  v.playsInline = true;
  v.play();
  const L = {
    id: ++nid,
    name,
    v,
    stream,
    x: 0,
    y: 0,
    w: cv.width,
    h: cv.height,
    vis: true,
  };
  v.onloadedmetadata = () => fit(L);
  layers.push(L);
  sel = L;
  renderLayers();
  return L;
}
function removeLayer(L) {
  if (L.stream) L.stream.getTracks().forEach((t) => t.stop());
  layers.splice(layers.indexOf(L), 1);
  if (sel === L) sel = null;
  renderLayers();
}
function renderLayers() {
  const el = $("layers");
  el.innerHTML = "";
  [...layers].reverse().forEach((L) => {
    const d = document.createElement("div");
    d.className = "layer" + (L === sel ? " sel" : "");
    const n = document.createElement("span");
    n.textContent = L.name;
    const eye = document.createElement("b");
    eye.textContent = L.vis ? "Ocultar" : "Mostrar";
    eye.onclick = (e) => {
      e.stopPropagation();
      L.vis = !L.vis;
      renderLayers();
    };
    const x = document.createElement("b");
    x.textContent = "Remover";
    x.onclick = (e) => {
      e.stopPropagation();
      removeLayer(L);
    };
    d.append(n, eye, x);
    d.onclick = () => {
      sel = L;
      renderLayers();
    };
    el.appendChild(d);
  });
}
$("fit").onclick = () => sel && fit(sel);
$("fill").onclick = () => sel && fit(sel, true);
$("up").onclick = () => {
  if (sel) {
    layers.splice(layers.indexOf(sel), 1);
    layers.push(sel);
    renderLayers();
  }
};

/* ---------- Fontes ---------- */
async function fillCams() {
  const devs = (await navigator.mediaDevices.enumerateDevices()).filter(
    (d) => d.kind === "videoinput",
  );
  $("camSel").innerHTML = "";
  devs.forEach((d, i) => {
    const o = document.createElement("option");
    o.value = d.deviceId;
    o.textContent = d.label || "Câmera " + (i + 1);
    $("camSel").appendChild(o);
  });
}
$("addCam").onclick = async () => {
  try {
    const id = $("camSel").value;
    await actx.resume();
    const st = await navigator.mediaDevices.getUserMedia({
      video: {
        deviceId: id ? { exact: id } : undefined,
        width: { ideal: 3840 },
        height: { ideal: 2160 },
        frameRate: { ideal: 60 },
      },
    });
    addLayer("Câmera", st);
    fillCams();
  } catch (e) {
    status("Câmera: " + e.message);
  }
};
$("addScr").onclick = async () => {
  const list = await lc.sources(),
    box = $("srcList");
  box.innerHTML = "";
  list.forEach((s) => {
    const d = document.createElement("div");
    d.className = "src";
    const img = document.createElement("img");
    img.src = s.thumb;
    const n = document.createElement("span");
    n.textContent = s.name;
    d.append(img, n);
    d.onclick = async () => {
      box.innerHTML = "";
      try {
        const st = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            mandatory: {
              chromeMediaSource: "desktop",
              chromeMediaSourceId: s.id,
              maxWidth: 3840,
              maxHeight: 2160,
              maxFrameRate: 60,
            },
          },
        });
        addLayer(s.name, st);
      } catch (e) {
        status("Tela: " + e.message);
      }
    };
    box.appendChild(d);
  });
};
fillCams();

/* ---------- Composição e edição (estilo OBS) ---------- */
const hs = () => (24 * cv.width) / 1920;
const corners = (L) => [
  [L.x, L.y, -1, -1],
  [L.x + L.w, L.y, 1, -1],
  [L.x, L.y + L.h, -1, 1],
  [L.x + L.w, L.y + L.h, 1, 1],
];
function render() {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, cv.width, cv.height);
  for (const L of layers)
    if (L.vis && L.v.readyState >= 2) ctx.drawImage(L.v, L.x, L.y, L.w, L.h);
  octx.clearRect(0, 0, ov.width, ov.height);
  if (sel) {
    octx.strokeStyle = "#3ecfd1";
    octx.lineWidth = (4 * cv.width) / 1920;
    octx.strokeRect(sel.x, sel.y, sel.w, sel.h);
    octx.fillStyle = "#3ecfd1";
    corners(sel).forEach(([x, y]) =>
      octx.fillRect(x - hs() / 2, y - hs() / 2, hs(), hs()),
    );
  }
}
setInterval(render, 1000 / 60); // setInterval: não é pausado em segundo plano

const pt = (e) => {
  const r = ov.getBoundingClientRect();
  return {
    x: ((e.clientX - r.left) * cv.width) / r.width,
    y: ((e.clientY - r.top) * cv.height) / r.height,
  };
};
let drag = null;
ov.onpointerdown = (e) => {
  const p = pt(e);
  const c =
    sel &&
    corners(sel).find(
      ([x, y]) => Math.abs(p.x - x) <= hs() && Math.abs(p.y - y) <= hs(),
    );
  if (c) drag = { m: "resize", sx: c[2], sy: c[3], p, o: { ...sel } };
  else {
    const hit = [...layers]
      .reverse()
      .find(
        (L) =>
          L.vis &&
          p.x >= L.x &&
          p.x <= L.x + L.w &&
          p.y >= L.y &&
          p.y <= L.y + L.h,
      );
    sel = hit || null;
    renderLayers();
    if (hit) drag = { m: "move", p, o: { ...hit } };
  }
  ov.setPointerCapture(e.pointerId);
};
ov.onpointermove = (e) => {
  if (!drag || !sel) return;
  const p = pt(e),
    dx = p.x - drag.p.x,
    dy = p.y - drag.p.y,
    o = drag.o;
  if (drag.m === "move") {
    sel.x = o.x + dx;
    sel.y = o.y + dy;
    return;
  }
  const w = Math.max(40, o.w + drag.sx * dx);
  const h = e.shiftKey ? Math.max(40, o.h + drag.sy * dy) : (w * o.h) / o.w;
  sel.w = w;
  sel.h = h;
  sel.x = drag.sx < 0 ? o.x + o.w - w : o.x;
  sel.y = drag.sy < 0 ? o.y + o.h - h : o.y;
};
ov.onpointerup = () => {
  drag = null;
};

$("res").onchange = () => {
  const [W, H] = $("res").value.split("x").map(Number),
    k = W / cv.width;
  layers.forEach((L) => {
    L.x *= k;
    L.y *= k;
    L.w *= k;
    L.h *= k;
  });
  cv.width = ov.width = W;
  cv.height = ov.height = H;
};

/* ---------- Gravação local ---------- */
let mr = null,
  wq = Promise.resolve();
async function toggleRec() {
  if (mr) {
    mr.stop();
    return;
  }
  const mime = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ].find((m) => MediaRecorder.isTypeSupported(m));
  await lc.recStart();
  const bitrate = Math.min(
    50_000_000,
    Math.max(12_000_000, cv.width * cv.height * 60 * 0.12),
  );
  mr = new MediaRecorder(out, { mimeType: mime, videoBitsPerSecond: bitrate });
  mr.ondataavailable = (e) => {
    if (e.data.size)
      wq = wq.then(async () => lc.recChunk(await e.data.arrayBuffer()));
  };
  mr.onstop = async () => {
    await wq;
    const f = await lc.recStop();
    mr = null;
    $("rec").classList.remove("on");
    refresh();
    status("Salvo em: " + f);
  };
  mr.start(1000);
  $("rec").classList.add("on");
  refresh();
}

/* ---------- Microfone e atalhos globais ---------- */
let KEYS = {};
function refresh() {
  $("rec").textContent =
    (mr ? "Parar gravação" : "Gravar") +
    (KEYS.record ? ` (${KEYS.record})` : "");
  $("mic").textContent =
    "Microfone: " +
    (micGain.gain.value ? "ligado" : "mudo") +
    (KEYS.mute ? ` (${KEYS.mute})` : "");
  $("volumeValue").textContent = `${$("volume").value}%`;
}
async function setVolume(value) {
  const volume = Number(value);
  if (!Number.isFinite(volume) || volume < 0 || volume > 100) return;
  await actx.resume();
  masterGain.gain.setTargetAtTime(volume / 100, actx.currentTime, 0.015);
  $("volumeValue").textContent = `${volume}%`;
}
function toggleMic() {
  const on = micGain.gain.value === 0;
  micGain.gain.value = on ? 1 : 0;
  refresh();
}
$("rec").onclick = async () => {
  await actx.resume();
  await toggleRec();
};
$("mic").onclick = async () => {
  await actx.resume();
  toggleMic();
};
$("volume").oninput = () =>
  setVolume($("volume").value).catch((error) =>
    status("Não foi possível ajustar o volume: " + error.message),
  );
lc.onShortcut((a) => ({ record: toggleRec, mute: toggleMic })[a]());

/* ---------- Rede: espectadores ---------- */
const peers = {};
function addLocalLink(container, title, url) {
  const heading = document.createElement("div");
  heading.className = "local-link-title";
  heading.textContent = title;
  const value = document.createElement("code");
  value.textContent = url;
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Copiar link";
  button.onclick = async () => {
    try {
      await lc.copyLink(url);
      status("Link copiado para a área de transferência.");
    } catch (error) {
      status("Não foi possível copiar o link: " + error.message);
    }
  };
  container.append(heading, value, button);
}

lc.info()
  .then((info) => {
    const mod = info.platform === "darwin" ? "Cmd" : "Ctrl";
    for (const [a, k] of Object.entries(info.keys))
      KEYS[a] = k.replace("CommandOrControl", mod).replace(/\+/g, "+");
    refresh();
    const browserSource = `http://127.0.0.1:${info.localPort}/viewer.html?audio=1`;
    const linkPanel = $("links");
    linkPanel.replaceChildren();
    addLocalLink(
      linkPanel,
      "OBS · Browser Source (neste computador)",
      browserSource,
    );
    const networkAddresses = (
      info.ips || [{ name: "Rede", address: info.ip }]
    ).filter((item) => item.address !== "127.0.0.1");
    if (!networkAddresses.length) {
      const help = document.createElement("small");
      help.textContent =
        "Nenhum endereço de rede encontrado. Conecte este computador ao Wi-Fi para disponibilizar a transmissão na rede local.";
      linkPanel.appendChild(help);
    } else {
      const network = document.createElement("select");
      network.setAttribute(
        "aria-label",
        "Adaptador de rede para espectadores",
      );
      for (const item of networkAddresses) {
        const option = document.createElement("option");
        option.value = item.address;
        option.textContent = `${item.name}: ${item.address}`;
        network.appendChild(option);
      }
      const networkLabel = document.createElement("div");
      networkLabel.className = "local-link-title";
      networkLabel.textContent = "Espectadores na rede local";
      linkPanel.append(networkLabel, network);
      const sharedLinks = document.createElement("div");
      linkPanel.appendChild(sharedLinks);
      const renderNetworkLinks = () => {
        sharedLinks.replaceChildren();
        const base = `https://${network.value}:${info.port}`;
        addLocalLink(
          sharedLinks,
          "Assistir transmissão",
          `${base}/viewer.html`,
        );
      };
      network.onchange = renderNetworkLinks;
      renderNetworkLinks();
      const help = document.createElement("small");
      help.textContent =
        "Os espectadores precisam estar na mesma rede Wi-Fi. Na primeira visita, aceite o aviso HTTPS. Se o link não abrir, permita o LinkCast na rede privada/firewall e desative o isolamento de dispositivos no Wi-Fi.";
      linkPanel.appendChild(help);
    }
    Signal(`wss://127.0.0.1:${info.port}`, {
      open: (s) => s.send({ t: "host", room: "main" }),
      msg: async (d, s) => {
        if (d.t === "peer") {
          const pc = new RTCPeerConnection(RTC_CONFIG);
          peers[d.id] = pc;
          pc.onicecandidate = (e) =>
            e.candidate &&
            s.send({ t: "signal", to: d.id, data: { ice: e.candidate } });
          const quality = [];
          out.getTracks().forEach((track) => {
            const sender = pc.addTrack(track, out);
            if (track.kind === "video") quality.push(setHighQuality(sender));
          });
          await Promise.all(
            quality.map((configure) =>
              configure.catch((error) => {
                status(
                  "Não foi possível aplicar a taxa máxima de qualidade: " +
                    error.message,
                );
              }),
            ),
          );
          await pc.setLocalDescription(await pc.createOffer());
          s.send({
            t: "signal",
            to: d.id,
            data: { sdp: pc.localDescription },
          });
        }
        if (d.t === "signal" && peers[d.from])
          await applySignal(peers[d.from], d.data, (x) =>
            s.send({ t: "signal", to: d.from, data: x }),
          );
        if (d.t === "gone" && peers[d.id]) {
          peers[d.id].close();
          delete peers[d.id];
        }
      },
    });
  })
  .catch((error) =>
    status("Não foi possível iniciar os links de rede: " + error.message),
  );

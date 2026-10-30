// Compartilhado entre o aplicativo host e o viewer.
window.RTC_CONFIG = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };
const pendingIce = new WeakMap();

window.Signal = function (url, h) {
  const ws = new WebSocket(url);
  const api = {
    send: (o) => {
      if (ws.readyState === 1) ws.send(JSON.stringify(o));
    },
  };
  ws.onopen = () => h.open(api);
  ws.onmessage = (e) =>
    Promise.resolve()
      .then(() => h.msg(JSON.parse(e.data), api))
      .catch((error) => {
        if (h.messageError) h.messageError(error);
        else console.error("Falha ao processar sinalização WebRTC:", error);
      });
  ws.onerror = (e) => {
    if (h.error)
      h.error(
        new Error("Não foi possível conectar ao servidor de sinalização."),
      );
    else console.error("Falha na conexão com o servidor de sinalização:", e);
  };
  ws.onclose = () => setTimeout(() => window.Signal(url, h), 2000);
  return api;
};

window.applySignal = async (pc, data, reply) => {
  if (data.sdp) {
    await pc.setRemoteDescription(data.sdp);
    const queued = pendingIce.get(pc) || [];
    pendingIce.delete(pc);
    for (const candidate of queued) await pc.addIceCandidate(candidate);
    if (data.sdp.type === "offer") {
      await pc.setLocalDescription(await pc.createAnswer());
      reply({ sdp: pc.localDescription });
    }
  } else if (data.ice) {
    if (!pc.remoteDescription) {
      const queued = pendingIce.get(pc) || [];
      queued.push(data.ice);
      pendingIce.set(pc, queued);
      return;
    }
    await pc.addIceCandidate(data.ice);
  }
};

window.setHighQuality = async (sender) => {
  const parameters = sender.getParameters();
  if (!parameters.encodings || !parameters.encodings.length)
    parameters.encodings = [{}];
  const track = sender.track;
  const settings = track ? track.getSettings() : {};
  const pixelsPerSecond =
    track && track.kind === "video"
      ? (settings.width || 1920) * (settings.height || 1080) * 60
      : 0;
  parameters.encodings[0].maxBitrate = Math.min(
    50_000_000,
    Math.max(12_000_000, Math.round(pixelsPerSecond * 0.12)),
  );
  parameters.encodings[0].maxFramerate = 60;
  parameters.degradationPreference = "maintain-resolution";
  await sender.setParameters(parameters);
};

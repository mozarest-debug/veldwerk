/* Veldwerk – koppeling met de Android-app (Capacitor).
   Doet niets in een gewone browser. In de Android-app:
   - geeft de lopende klok door aan melding, statusbalk, snelmenutegel en herinnering
   - voert acties uit van meldingsknoppen en tegel (Vertrek, Wissel, Notitie, Pin)
   - slaat exports op in Downloads/Veldwerk en deelt ze via het Android-deelmenu */
"use strict";
(function () {
  const C = window.Capacitor;
  if (!C || !C.isNativePlatform || !C.isNativePlatform()) return;
  const V = C.Plugins && C.Plugins.Veldwerk;
  if (!V) return;
  window.VW_NATIVE = true;

  function stateObj() {
    const o = { running: null, travel: null, reminderHour: S.settings.reminderHour || 18 };
    const r = running();
    if (r) {
      const onP = segsOn(dkey(new Date())).filter(s => s.pid === r.pid);
      const first = onP.length ? onP[0].start : r.start;
      o.running = { nr: pnr(r.pid), name: pname(r.pid), start: new Date(first).getTime(), since: hm(first) };
    } else if (S.travel) {
      o.travel = { since: new Date(S.travel.since).getTime(), from: S.travel.fromPid ? pnr(S.travel.fromPid) : "" };
    }
    // gegevens voor de widgets
    const dark = S.settings.theme === "dark" || (S.settings.theme !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
    o.theme = dark ? "dark" : "light";
    const k = dkey(new Date());
    o.meas = S.meas.filter(m => nextStep(m)).sort((a, b) => (b.steps.gemeten || b.created).localeCompare(a.steps.gemeten || a.created)).slice(0, 40).map(m => {
      const n = nextStep(m);
      const lbl = m.kind === "kd" ? n[1] : (n[0] === "gemeten" ? "Gepland" : NEXTLBL[n[0]]);
      return { id: m.id, title: m.name, sub: (m.pids.map(pnr).join(" + ") || "") + (m.steps.gemeten ? " · " + dtShort(m.steps.gemeten) : ""), pill: lbl, warn: n[0] === "export" };
    });
    o.tasks = S.tasks.filter(t => !t.done).sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999")).slice(0, 40).map(t => ({
      id: t.id, title: t.title, sub: [t.due ? (t.due === k ? "vandaag" : t.due < k ? "te laat · " + dShort(t.due) : dShort(t.due)) : "", t.mid && M(t.mid) ? M(t.mid).name : ""].filter(Boolean).join(" · "),
      pill: t.pid && P(t.pid) ? woCode(t.pid) : "", warn: !!(t.due && t.due <= k) }));
    o.notes = S.notes.slice().sort((a, b) => (b.updated || b.created).localeCompare(a.updated || a.created)).slice(0, 30).map(n => ({
      id: n.id, title: n.title || "Notitie", sub: dtShort(n.created) + (n.photos.length ? " · " + n.photos.length + " foto" + (n.photos.length > 1 ? "'s" : "") : ""),
      pill: n.pids[0] ? woCode(n.pids[0]) : "", warn: !!(n.action && !n.actionDone) }));
    o.radius = S.settings.radius || 150;
    o.projects = activeProjects().map(p => ({ id: p.id, nr: p.nr, name: p.name || "", code: woCode(p.id), indirect: !!p.indirect, locs: (p.locs || []).slice(-20).map(l => [l.lat, l.lng]) }))
      .sort((a, b) => lastUse(b.id).localeCompare(lastUse(a.id)) || a.nr.localeCompare(b.nr));
    o.runningPid = r ? r.pid : "";
    return o;
  }
  let last = "";
  window.nativeSync = function () {
    const s = JSON.stringify(stateObj());
    if (s === last) return;
    last = s;
    V.sync(JSON.parse(s)).catch(() => { });
  };
  const _save = save;
  save = function () { _save(); nativeSync(); };

  function applyPin(op) {
    const p = P(op.pid); if (!p) return;
    const at = new Date(op.at).toISOString();
    if (op.link && typeof op.lat === "number") p.locs.push({ lat: op.lat, lng: op.lng, at });
    const tr = S.travel;
    stopRunning(at);
    if (tr && new Date(at) - new Date(tr.since) >= 60000) startSeg(p.id, tr.since, "reis").end = at;
    S.travel = null;
    startSeg(p.id, at, "werk", typeof op.lat === "number" ? { lat: op.lat, lng: op.lng } : null);
  }
  function applyAdd(op) {
    const d = op.data || {}, at = new Date(op.at || Date.now()).toISOString();
    if (op.kind === "task") S.tasks.push({ id: uid("t"), title: d.title || "Taak", due: d.due || "", done: false, pid: d.pid || "", mid: "", noteId: "", created: at });
    else if (op.kind === "note") { const n = newNote({ title: d.title || "", body: d.body || "", pids: d.pid ? [d.pid] : [], action: !!d.action, created: at }); n.id = uid("n"); if (!n.title) n.title = (n.body.split("\n")[0] || "Notitie").slice(0, 60); S.notes.push(n); syncActionTask(n); }
    else if (op.kind === "meas") S.meas.push({ id: uid("m"), name: d.name || "Meting", pids: d.pid ? [d.pid] : [], steps: { gemeten: d.gemeten === false ? null : at, export: null, verwerkt: null, verzonden: null, projectmap: null }, created: at });
  }
  async function applyOps() {
    try {
      const r = await V.pendingOps(); const ops = JSON.parse((r && r.ops) || "[]");
      let n = 0;
      ops.sort((a, b) => (a.at || 0) - (b.at || 0));
      for (const op of ops) if (op.type === "pin") { applyPin(op); n++; }
      else if (op.type === "add") { applyAdd(op); n++; }
      else if (op.type === "taskdone") { const t = T(op.id); if (t && !t.done) { t.done = true; t.doneAt = new Date(op.at || Date.now()).toISOString(); if (t.noteId && N(t.noteId)) N(t.noteId).actionDone = true; n++; } }
      if (n) { save(); render(); toast(n === 1 ? "Widget-actie verwerkt" : n + " widget-acties verwerkt"); }
    } catch (e) { }
  }
  async function doAction() {
    await applyOps();
    let a = null;
    try { const r = await V.pendingAction(); a = r && r.action; } catch (e) { return; }
    if (!a) return;
    closeSheet(); back.length = 0; view = { name: "vandaag" }; render();
    const r = running();
    if (a === "depart") { if (r) departSheet(); }
    else if (a === "switch") { if (r) switchSheet(); }
    else if (a === "note") { noteSheet(newNote({ pids: r ? [r.pid] : [] })); }
    else if (a === "pin") { if (!r) doPin(); }
    else if (a === "stoptravel") { S.travel = null; save(); render(); toast("Reistijd gestopt"); }
    else if (a === "editday") { go("dagbewerken", { k: dkey(new Date()) }); }
    else if (a.startsWith("meas:")) { if (M(a.slice(5))) go("meting", { id: a.slice(5) }); }
    else if (a.startsWith("task:")) { if (T(a.slice(5))) taskSheet(T(a.slice(5))); }
    else if (a.startsWith("note:")) { if (N(a.slice(5))) noteSheet(N(a.slice(5))); }
    else if (a === "new:meas") { measNewSheet(r ? r.pid : ""); }
    else if (a === "new:task") { taskSheet(null, { pid: r ? r.pid : "" }); }
    else if (a === "new:note") { noteSheet(newNote({ pids: r ? [r.pid] : [] })); }
  }
  try { matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => nativeSync()); } catch (e) { }
  setInterval(() => { if (!document.hidden) nativeSync(); }, 60000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) { doAction(); nativeSync(); } });

  // Exports: opslaan in Downloads/Veldwerk + delen via Android
  deliver = function (blob, name) {
    const mime = blob.type || "application/octet-stream";
    openSheet(`<h3>Opslaan…</h3><p class="lead">${esc(name)}</p>`);
    b64(blob).then(data => V.saveFile({ name, mime, data })).then(res => {
      openSheet(`<h3>Export klaar</h3><p class="lead">${esc(name)} · ${(blob.size / 1048576).toFixed(1)} MB${res && res.saved ? "<br>Opgeslagen in Downloads/Veldwerk" : ""}</p>
        <div class="actions" style="flex-direction:column"><button class="btn" id="nShare">${I.share} Delen (mail, Teams, Drive…)</button><button class="btn ghost" data-act="close">Sluit</button></div>`, () => {
        $("#nShare").onclick = () => V.shareFile({ name, mime }).catch(e => toast(e.message || "Delen mislukt"));
      });
    }).catch(e => { closeSheet(); toast("Opslaan mislukt: " + (e.message || e)); });
  };

  const _settings = settingsSheet;
  settingsSheet = async function () {
    await _settings();
    const acts = sheet.querySelector(".actions"); if (!acts || !V.openWidgetSettings) return;
    const d = document.createElement("div");
    d.innerHTML = `<div class="q">Widgets</div><button class="btn ghost block" id="wSet">Widgets aanpassen (kleuren, dekking, grootte)</button>`;
    acts.before(d);
    $("#wSet").onclick = () => V.openWidgetSettings().then(r => { if (r && r.count === 0) toast("Plaats eerst een Veldwerk-widget op je startscherm"); }).catch(e => toast(e.message || "Widgets aanpassen mislukt"));
  };
  const boot = () => {
    if (!window.VW_READY) { setTimeout(boot, 300); return; }
    if (!S.settings.mods) { S.settings.mods = { lm: true, kd: false }; _save(); }
    V.requestNotify().catch(() => { });
    nativeSync();
    doAction();
  };
  boot();
})();

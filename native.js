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

  async function doAction() {
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
  }
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

  const boot = () => {
    if (!window.VW_READY) { setTimeout(boot, 300); return; }
    if (!S.settings.mods) { S.settings.mods = { lm: true, kd: false }; _save(); }
    V.requestNotify().catch(() => { });
    nativeSync();
    doAction();
  };
  boot();
})();

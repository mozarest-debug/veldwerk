/* Veldwerk v1.1 – aanvullingen:
   zoekbare werkorderkeuze, meetnamen (R/M/ZB), taken vanuit metingen, gefilterde taakkeuze,
   onderdelen aan/uit, kwaliteitsdienst (verdichting, proef 8) met export naar eigen Excel-sjabloon. */
"use strict";
(function () {
  const st = document.createElement("style");
  st.textContent = `.cb{position:relative}.cbl{position:absolute;left:0;right:0;top:calc(100% + 4px);z-index:30;background:var(--card);border:1px solid var(--line);border-radius:12px;max-height:260px;overflow:auto;box-shadow:0 8px 24px rgba(0,0,0,.22)}
.cbl button{display:block;width:100%;text-align:left;padding:11px 12px;border:0;border-bottom:1px dashed var(--line);background:none;font-size:15px;font-weight:600;cursor:pointer}
.cbl button:last-child{border-bottom:0}.cbl b{color:var(--accent)}`;
  document.head.appendChild(st);
})();

/* ---------- Zoekbare werkorderkeuze ---------- */
const WO_SELECTS = ["pWo", "lWo", "wWo", "gP", "tP", "mP", "xP"];
function lastUse(pid) { let t = ""; for (const s of S.segs) if (s.pid === pid && s.start > t) t = s.start; return t; }
function enhanceWo(root) {
  WO_SELECTS.forEach(id => {
    const sel = root.querySelector("#" + id);
    if (!sel || sel.tagName !== "SELECT" || sel.dataset.cb) return;
    sel.dataset.cb = "1"; sel.classList.add("hidden");
    const wrap = document.createElement("div"); wrap.className = "cb";
    wrap.innerHTML = `<input type="search" class="cbq" autocomplete="off" enterkeyhint="done" aria-label="Zoek werkorder"><div class="cbl hidden" role="listbox"></div>`;
    sel.after(wrap);
    const q = wrap.querySelector("input"), list = wrap.querySelector(".cbl");
    const cur = () => sel.selectedOptions[0];
    const label = () => { const o = cur(); q.value = o && o.value ? o.textContent : ""; q.placeholder = o && !o.value ? o.textContent + " · typ om te zoeken" : "Typ werknummer of naam…"; };
    label();
    const show = () => {
      const s = q.value.trim().toLowerCase();
      let items = [...sel.options].map(o => ({ v: o.value, t: o.textContent, l: o.textContent.toLowerCase() }));
      const typing = s && !(cur() && q.value === cur().textContent);
      if (typing) {
        items = items.filter(i => i.v && i.l.includes(s))
          .sort((a, b) => (b.l.startsWith(s) - a.l.startsWith(s)) || a.l.indexOf(s) - b.l.indexOf(s) || a.t.localeCompare(b.t));
      } else {
        const none = items.filter(i => !i.v), rest = items.filter(i => i.v);
        rest.sort((a, b) => lastUse(b.v).localeCompare(lastUse(a.v)) || a.t.localeCompare(b.t));
        items = none.concat(rest);
      }
      const hl = t => { if (!typing) return esc(t); const i = t.toLowerCase().indexOf(s); return i < 0 ? esc(t) : esc(t.slice(0, i)) + "<b>" + esc(t.slice(i, i + s.length)) + "</b>" + esc(t.slice(i + s.length)); };
      list.innerHTML = items.slice(0, 50).map(i => `<button type="button" data-v="${esc(i.v)}">${hl(i.t)}</button>`).join("") || `<div class="empty" style="padding:10px 12px">Geen werkorder gevonden</div>`;
      list.classList.remove("hidden");
    };
    q.addEventListener("focus", () => { setTimeout(() => q.select(), 0); show(); });
    q.addEventListener("input", show);
    list.addEventListener("pointerdown", e => e.preventDefault());
    list.addEventListener("click", e => {
      const b = e.target.closest("button[data-v]"); if (!b) return;
      sel.value = b.dataset.v; sel.dispatchEvent(new Event("change", { bubbles: true }));
      label(); list.classList.add("hidden"); q.blur();
    });
    q.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); const b = list.querySelector("button[data-v]"); if (b) b.click(); } });
    q.addEventListener("blur", () => setTimeout(() => { list.classList.add("hidden"); label(); }, 180));
    sel._cbRefresh = label;
  });
}
openSheet = function (html, mount) { sheet.innerHTML = html; modal.classList.add("open"); sheet.scrollTop = 0; enhanceWo(sheet); if (mount) mount(); };

/* ---------- Meetnamen ---------- */
const yymmdd = d => { d = d || new Date(); return String(d.getFullYear()).slice(2) + pad(d.getMonth() + 1) + pad(d.getDate()); };
function woCode(pid) { const nr = (P(pid) || {}).nr || ""; const m = nr.match(/^[A-Za-z]{1,5}\d+(-\d+)?/); return (m ? m[0] : nr.split(/\s/)[0] || "").toUpperCase(); }
function genName(pid, type) {
  const base = woCode(pid) + (type === "R" ? "R" : "M") + yymmdd() + (type === "ZB" ? "ZB" : "");
  let n = base, i = 2; while (S.meas.some(m => m.name === n)) n = base + "-" + i++;
  return n;
}

/* ---------- Stappen per soort meting ---------- */
const KDSTEPS = [["gemeten", "Gemeten", "Gemeten"], ["lab", "Monsters naar lab", "Naar lab"], ["labklaar", "Lab gereed", "Lab klaar"], ["rapport", "Gerapporteerd", "Rapport"]];
stepsOf = m => m && m.kind === "kd" ? KDSTEPS : STEPS;
stepsBar = function (m) {
  const ss = stepsOf(m), n = nextStep(m);
  return `<div class="steps" style="grid-template-columns:repeat(${ss.length},minmax(0,1fr))">${ss.map(([k]) => `<i class="${m.steps[k] ? "d" : n && n[0] === k ? "n" : ""}"></i>`).join("")}${ss.map(s => `<span>${s[2]}</span>`).join("")}</div>`;
};
const _measPill = measPill;
measPill = function (m) {
  if (m.kind !== "kd") return _measPill(m);
  const n = nextStep(m);
  return n ? `<span class="pill ${n[0] === "lab" ? "warn" : "mid"}">KD · ${esc(n[1].toLowerCase())}</span>` : `<span class="pill ok">KD · klaar</span>`;
};
const mods = () => Object.assign({ lm: true, kd: true }, S.settings.mods || {});

/* ---------- Nieuwe meting ---------- */
measNewSheet = function (pid) {
  const r = running(); pid = pid || (r && r.pid) || "";
  const md = mods(); let cat = md.lm ? "lm" : "kd", type = "M", st = 1, edited = false;
  openSheet(`<h3>Nieuwe meting</h3>
    ${md.lm && md.kd ? `<div class="seg" id="mC" style="margin:8px 0 2px"><button data-c="lm" class="on">Landmeten</button><button data-c="kd">Kwaliteitsdienst</button></div>` : ""}
    <label class="l" for="mP">Werkorder</label><select id="mP">${projOptions(pid, { none: "– kies –" })}</select>
    <div id="mLM" class="${cat === "lm" ? "" : "hidden"}">
      <label class="l">Type meting</label><div class="seg" style="--n:3" id="mT"><button data-t="R">R · revisie</button><button data-t="M" class="on">M · meting</button><button data-t="ZB">ZB · zakbaken</button></div>
      <label class="l" for="mN">Naam</label><input type="text" id="mN" autocapitalize="characters"><div class="meta" id="mNh" style="margin-top:4px"></div>
      <div class="q">Status</div><div class="seg" style="--n:3" id="mS"><button data-s="0">Gepland</button><button data-s="1" class="on">Gemeten</button><button data-s="2">Geëxporteerd</button></div>
    </div>
    <div id="mKD" class="${cat === "kd" ? "" : "hidden"}">
      <label class="l">Onderzoek</label><div class="seg" style="--n:1"><button class="on">Verdichting · nucleair (proef 8)</button></div>
      <div class="meta" style="margin-top:6px">Steekring (proef 6) en asfaltbegeleiding volgen in een volgende versie.</div>
    </div>
    <div class="actions"><button class="btn ghost" data-act="close">Annuleer</button><button class="btn" id="mOk">Opslaan</button></div>`, () => {
    const setName = () => {
      if (edited) return; const p = $("#mP").value;
      $("#mN").value = p ? genName(p, type) : "";
      $("#mNh").textContent = p ? ($("#mN").value.includes("-") ? "Deze naam bestond al: achtervoegsel toegevoegd, pas gerust aan." : "Werknummer + type + datum van vandaag. Pas aan als dat nodig is.") : "Kies eerst een werkorder.";
    };
    setName();
    $("#mN").addEventListener("input", () => { edited = true; });
    $("#mP").addEventListener("change", setName);
    $$("#mT button").forEach(b => b.onclick = () => { type = b.dataset.t; edited = false; $$("#mT button").forEach(x => x.classList.toggle("on", x === b)); setName(); });
    $$("#mS button").forEach(b => b.onclick = () => { st = +b.dataset.s; $$("#mS button").forEach(x => x.classList.toggle("on", x === b)); });
    $$("#mC button").forEach(b => b.onclick = () => { cat = b.dataset.c; $$("#mC button").forEach(x => x.classList.toggle("on", x === b)); $("#mLM").classList.toggle("hidden", cat !== "lm"); $("#mKD").classList.toggle("hidden", cat !== "kd"); });
    $("#mOk").onclick = () => {
      const pv = $("#mP").value, at = nowISO();
      if (cat === "kd") {
        if (!pv) return toast("Kies een werkorder");
        const prev = S.meas.filter(x => x.kind === "kd").sort((a, b) => b.created.localeCompare(a.created));
        const same = prev.find(x => x.pids.includes(pv)) || prev[0];
        const pr = P(pv);
        const m = { id: uid("m"), kind: "kd", name: `${woCode(pv)} verdichting ${dkey(new Date()).split("-").reverse().join("-")}`, pids: [pv], steps: { gemeten: null, lab: null, labklaar: null, rapport: null }, created: at,
          kd: { opdrachtgever: same ? same.kd.opdrachtgever : "", tav: same && same.pids.includes(pv) ? same.kd.tav : "", project: same && same.pids.includes(pv) ? same.kd.project : (pr.name || ""), locatie: "", klantnr: woCode(pv), datum: dkey(new Date()), materiaal: same ? same.kd.materiaal : "Zand", eisInd: same ? same.kd.eisInd : 95, eisGem: same ? same.kd.eisGem : 100, points: [] } };
        S.meas.push(m); save(); closeSheet(); go("meting", { id: m.id }); setTimeout(() => kdHeaderSheet(m), 50); return;
      }
      const name = $("#mN").value.trim(); if (!name) return toast("Geef de meting een naam");
      const m = { id: uid("m"), name, pids: pv ? [pv] : [], steps: { gemeten: st >= 1 ? at : null, export: st >= 2 ? at : null, verwerkt: null, verzonden: null, projectmap: null }, created: at };
      S.meas.push(m); save(); closeSheet(); go("meting", { id: m.id });
    };
  });
};
const _departSheet = departSheet;
departSheet = function () { const r = running(); _departSheet(); const n = $("#dN0"); if (r && n && mods().lm) n.value = genName(r.pid, "M"); };

/* ---------- Taken bij een meting ---------- */
function injectMeasTasks(m) {
  const main = $("#main"); const acts = [...main.querySelectorAll(".actions")].pop();
  const ts = S.tasks.filter(t => t.mid === m.id);
  const f = document.createElement("div");
  f.innerHTML = `<div class="sec">Taken bij deze meting</div><div class="card">${ts.map(taskRow).join("") || `<div class="empty">Nog geen taken.</div>`}<button class="btn dash block" id="mTask" style="margin-top:8px">+ Taak bij deze meting</button></div>`;
  if (acts) acts.before(f); else main.appendChild(f);
  $("#mTask").onclick = () => taskSheet(null, { pid: m.pids[0] || "", mid: m.id, title: "Uitwerken " + m.name });
}
const _rMeting = rMeting;
rMeting = function () {
  const m = M(view.id);
  if (m && m.kind === "kd") return rKD(m);
  _rMeting(); if (m) injectMeasTasks(m);
};

/* ---------- Taakkeuze filteren op werkorder ---------- */
const _taskSheet = taskSheet;
taskSheet = function (t, pre = {}) {
  _taskSheet(t, pre);
  const tp = $("#tP"), tm = $("#tM"); if (!tp || !tm) return;
  if (!t && pre.title) $("#tT").value = pre.title;
  const fill = keep => {
    const pid = tp.value;
    const ms = S.meas.filter(m => (!pid || m.pids.includes(pid)) && (nextStep(m) || m.id === keep));
    tm.innerHTML = `<option value="">– geen –</option>` + ms.map(m => `<option value="${m.id}" ${m.id === keep ? "selected" : ""}>${esc(m.name)}</option>`).join("");
  };
  fill((t && t.mid) || pre.mid || "");
  tp.addEventListener("change", () => { const k = tm.value && M(tm.value) && M(tm.value).pids.includes(tp.value) ? tm.value : ""; fill(k); });
  tm.addEventListener("change", () => { const m = M(tm.value); if (m && m.pids[0] && !m.pids.includes(tp.value)) { tp.value = m.pids[0]; tp._cbRefresh && tp._cbRefresh(); fill(m.id); } });
};

/* ---------- Zoeken in projecten ---------- */
const _rProjecten = rProjecten;
rProjecten = function () {
  _rProjecten();
  if (ui.projTab !== "lijst") return;
  const inp = document.createElement("input");
  inp.type = "search"; inp.placeholder = "Zoek werkorder…"; inp.style.marginBottom = "10px"; inp.value = ui.projQ || ""; inp.setAttribute("aria-label", "Zoek werkorder");
  $("#main .vseg").after(inp);
  const apply = () => { const s = inp.value.trim().toLowerCase(); ui.projQ = inp.value; $$('#main [data-act="openproj"]').forEach(r => r.classList.toggle("hidden", !!s && !r.textContent.toLowerCase().includes(s))); };
  inp.oninput = apply; apply();
};

/* ---------- Delen ---------- */
const _deliver = deliver;
deliver = function (blob, name) {
  _deliver(blob, name);
  if (/\.(zip|xlsx|json)$/i.test(name)) {
    const sb = $("#shB"); if (sb) sb.remove();
    const p = document.createElement("div"); p.className = "notice"; p.style.marginTop = "12px";
    p.innerHTML = `<b>Delen:</b> zip- en Excel-bestanden kun je vanuit de app meestal niet direct delen. Tik op Downloaden en deel het bestand daarna vanuit je map <b>Downloads</b> (of Bestanden) via mail, Teams of Drive.`;
    sheet.appendChild(p);
  }
};

/* ---------- Instellingen: onderdelen + sjabloon ---------- */
const _settingsSheet = settingsSheet;
settingsSheet = async function () {
  await _settingsSheet();
  const md = mods();
  let tpl = null; try { tpl = await DB.get("kdTemplate"); } catch (e) { }
  const box = document.createElement("div");
  box.innerHTML = `<div class="q">Onderdelen</div>
    <label class="check"><input type="checkbox" id="sLM" ${md.lm ? "checked" : ""}> Landmeten (R, M, ZB-metingen)</label>
    <label class="check"><input type="checkbox" id="sKD" ${md.kd ? "checked" : ""}> Kwaliteitsdienst (verdichtingsmetingen)</label>
    <div id="sKDbox" class="${md.kd ? "" : "hidden"}">
      <label class="l">Excel-sjabloon kwaliteitsdienst</label>
      <div class="meta" style="margin-bottom:6px">${tpl ? `Ingeladen: <b>${esc(S.settings.kdTplName || "sjabloon.xlsx")}</b>` : "Nog geen sjabloon. Laad het lege rapportagesjabloon (RAW 2020 Strassentest) in."}</div>
      <button class="btn ghost block" id="sTpl">${tpl ? "Ander sjabloon inladen" : "Sjabloon inladen (.xlsx)"}</button>
      <input type="file" id="sTplIn" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" class="hidden">
    </div>`;
  const acts = sheet.querySelector(".actions"); acts.before(box);
  const upd = () => {
    const lm = $("#sLM").checked, kd = $("#sKD").checked;
    if (!lm && !kd) { $("#sLM").checked = true; return toast("Minstens één onderdeel moet aan staan"); }
    S.settings.mods = { lm, kd }; $("#sKDbox").classList.toggle("hidden", !kd); save();
  };
  $("#sLM").onchange = upd; $("#sKD").onchange = upd;
  $("#sTpl").onclick = () => { $("#sTplIn").value = ""; $("#sTplIn").click(); };
  $("#sTplIn").onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const files = await unzipXlsx(f); const names = sheetMap(files).map(s => s.name.trim());
      if (!names.includes("Invoer proef 8") || !names.includes("Voorblad")) throw new Error("tabbladen Voorblad / Invoer proef 8 niet gevonden");
      await DB.set("kdTemplate", f.slice(0, f.size, f.type)); S.settings.kdTplName = f.name; save();
      toast("Sjabloon ingeladen"); settingsSheet();
    } catch (err) { toast("Geen geldig sjabloon: " + err.message); }
  };
  const v = [...sheet.querySelectorAll(".meta")].pop(); if (v && /Veldwerk v/.test(v.textContent)) v.textContent = "Veldwerk v1.1";
};

/* =================== KWALITEITSDIENST =================== */
function rKD(m) {
  const k = m.kd, n = nextStep(m);
  setTop(m.name, "Kwaliteitsdienst · verdichting proef 8", { back: true });
  const pts = k.points, mons = pts.filter(p => p.monster);
  const avg = pts.length ? Math.round(pts.reduce((a, p) => a + (+p.rhon || 0), 0) / pts.length) : 0;
  let h = `<div class="card">${stepsBar(m)}${n ? `<button class="btn block" data-act="stepnow" data-k="${n[0]}" style="margin-top:12px">Markeer: ${esc(n[1].toLowerCase())}</button>` : `<div class="notice" style="margin:12px 0 0">Alle stappen afgerond.</div>`}</div>
    <div class="card"><h2>Gegevens voorblad <button class="mini" id="kdEd">Bewerk</button></h2>
      <div class="meta" style="line-height:1.6;color:var(--ink)">${esc(k.opdrachtgever || "–")}${k.tav ? " · t.a.v. " + esc(k.tav) : ""}<br><b>${esc(k.project || "–")}</b> · ${esc(k.locatie || "meetlocatie?")}<br>Projectnr. klant ${esc(k.klantnr || "–")} · ${k.datum ? dShort(k.datum) : ""} · ${esc(k.materiaal)}<br>Eisen: per punt ≥ ${esc(k.eisInd)}% · gemiddeld ≥ ${esc(k.eisGem)}%</div></div>
    <div class="sec">Meetpunten · ${pts.length}${pts.length ? ` · gem. ρn ${avg} kg/m³` : ""}</div>
    <div class="card" style="padding:6px 14px"><table class="st"><thead><tr><th>#</th><th>Vak</th><th class="r">Diepte</th><th class="r">ρn</th><th>Monster</th><th class="r">Foto</th></tr></thead><tbody>
      ${pts.map((p, i) => `<tr class="click" data-kp="${i}"><td><b>${p.nr}</b></td><td>${esc(p.vak)}</td><td class="r num">${esc(p.diepte)}</td><td class="r num"><b>${esc(p.rhon)}</b></td><td>${p.monster ? `<span class="pill mid">${esc(p.monster)} · ${esc(p.voor)}</span>` : ""}</td><td class="r">${p.photos.length || ""}</td></tr>`).join("") || `<tr><td colspan="6" class="empty">Nog geen meetpunten.</td></tr>`}
    </tbody></table></div>
    <button class="btn block" id="kdAdd" style="margin-bottom:12px">+ Meetpunt</button>
    ${mons.length ? `<div class="notice"><b>Naar het lab:</b> ${mons.map(p => esc(p.monster) + " (" + esc(p.voor) + ", punt " + p.nr + ")").join(", ")}</div>` : ""}
    <button class="btn ghost block" id="kdExp">${I.share} Exporteer Excel + foto's</button>
    <div class="actions"><button class="btn ghost" data-act="renamemeas">Naam wijzigen</button><button class="btn danger" data-act="delmeas">Verwijder</button></div>`;
  $("#main").innerHTML = h;
  $("#kdEd").onclick = () => kdHeaderSheet(m);
  $("#kdAdd").onclick = () => kdPointSheet(m, -1);
  $$("[data-kp]").forEach(r => r.onclick = () => kdPointSheet(m, +r.dataset.kp));
  $("#kdExp").onclick = () => kdExport(m);
  injectMeasTasks(m);
  setFab(() => kdPointSheet(m, -1));
}
function kdHeaderSheet(m) {
  const k = m.kd;
  const mats = ["Zand", "Menggranulaat", "Betongranulaat", "Asfalt"];
  openSheet(`<h3>Gegevens voorblad</h3>
    <label class="l" for="kO">Opdrachtgever</label><input type="text" id="kO" value="${esc(k.opdrachtgever)}" placeholder="bijv. AW Infrabouw">
    <label class="l" for="kT">T.a.v.</label><input type="text" id="kT" value="${esc(k.tav)}" placeholder="bijv. Dhr Nieuwenhuis">
    <label class="l" for="kP">Project</label><input type="text" id="kP" value="${esc(k.project)}" placeholder="bijv. Victoriapark Hoofddorp">
    <div class="pair"><div><label class="l" for="kL">Meetlocatie / laag</label><input type="text" id="kL" value="${esc(k.locatie)}" placeholder="bijv. Cunet"></div><div><label class="l" for="kK">Projectnr. klant</label><input type="text" id="kK" value="${esc(k.klantnr)}"></div></div>
    <label class="l" for="kD">Datum meting</label><input type="date" id="kD" value="${esc(k.datum)}">
    <label class="l">Materiaal</label><div class="seg" style="--n:2" id="kM">${mats.map(x => `<button data-v="${x}" class="${k.materiaal === x ? "on" : ""}">${x}</button>`).join("")}</div>
    <div class="pair"><div><label class="l" for="kE1">Eis per punt ≥ %</label><input type="number" id="kE1" value="${esc(k.eisInd)}" inputmode="decimal"></div><div><label class="l" for="kE2">Eis gemiddeld ≥ %</label><input type="number" id="kE2" value="${esc(k.eisGem)}" inputmode="decimal"></div></div>
    <div class="actions"><button class="btn ghost" data-act="close">Annuleer</button><button class="btn" id="kOk">Opslaan</button></div>`, () => {
    let mat = k.materiaal;
    $$("#kM button").forEach(b => b.onclick = () => { mat = b.dataset.v; $$("#kM button").forEach(x => x.classList.toggle("on", x === b)); });
    $("#kOk").onclick = () => {
      Object.assign(k, { opdrachtgever: $("#kO").value.trim(), tav: $("#kT").value.trim(), project: $("#kP").value.trim(), locatie: $("#kL").value.trim(), klantnr: $("#kK").value.trim(), datum: $("#kD").value || k.datum, materiaal: mat, eisInd: $("#kE1").value, eisGem: $("#kE2").value });
      save(); closeSheet(); render();
    };
  });
}
function kdPointSheet(m, idx) {
  const k = m.kd, isNew = idx < 0, last = k.points[k.points.length - 1];
  const p = isNew ? { id: uid("kp"), nr: k.points.length + 1, vak: last ? last.vak : "a", diepte: last ? last.diepte : "30", rhon: "", monster: "", voor: "MPD", opm: "", photos: [], lat: null, lng: null, acc: null, at: nowISO() } : JSON.parse(JSON.stringify(k.points[idx]));
  const draft = { photos: p.photos };
  let gpsTried = !isNew;
  const draw = () => {
    openSheet(`<div style="display:flex;justify-content:space-between;align-items:center"><h3>Meetpunt ${p.nr}</h3><span class="meta">${esc(k.locatie || "")}</span></div>
      <div class="meta num" id="kGps" style="margin:4px 0 8px">${typeof p.lat === "number" ? `GPS ${fmtLL(p.lat, p.lng)} ±${Math.round(p.acc || 0)} m` : gpsTried ? "Geen GPS-positie" : "GPS zoeken…"} <button class="mini" id="kG" style="margin-left:6px">Opnieuw</button></div>
      <div class="pair"><div><label class="l" for="pV">Meetvak</label><input type="text" id="pV" value="${esc(p.vak)}"></div><div><label class="l" for="pD">Diepte meting (cm)</label><input type="number" id="pD" value="${esc(p.diepte)}" inputmode="decimal"></div></div>
      <label class="l" for="pR">Natte dichtheid in situ ρn (kg/m³)</label><input type="number" id="pR" value="${esc(p.rhon)}" inputmode="numeric" style="font-size:22px;font-weight:800;border:2px solid var(--accent)">
      <label class="l">Monster genomen voor het lab?</label><div class="seg" id="pM"><button data-v="1" class="${p.monster ? "on" : ""}">Ja</button><button data-v="0" class="${p.monster ? "" : "on"}">Nee</button></div>
      <div id="pMon" class="${p.monster ? "" : "hidden"}"><div class="pair"><div><label class="l" for="pMn">Monsternummer</label><input type="text" id="pMn" value="${esc(p.monster || p.nr + "a")}"></div>
        <div><label class="l">Voor</label><div class="seg" style="--n:3" id="pVo">${["MPD", "EPD", "vocht"].map(x => `<button data-v="${x}" class="${p.voor === x ? "on" : ""}">${x}</button>`).join("")}</div></div></div></div>
      <label class="l">Foto's</label>
      <div class="thumbs" style="margin-top:0">${draft.photos.map(pid => `<div class="thumb" data-vp="${pid}"><img data-ph="${pid}" alt="Foto"></div>`).join("")}
        <button class="thumb" id="pCam" style="border:1.5px dashed var(--line2);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;font-weight:800;font-size:13px;background:var(--bg)">${I.cam}Camera</button></div>
      <label class="l" for="pO">Opmerking</label><input type="text" id="pO" value="${esc(p.opm)}" placeholder="bijv. nat na regen">
      <div class="actions">${isNew ? `<button class="btn ghost" id="pX">Annuleer</button>` : `<button class="btn danger" id="pDel">Verwijder</button>`}<button class="btn" id="pOk">Opslaan</button></div>
      ${isNew ? `<button class="btn ghost block" id="pNext" style="margin-top:8px">Opslaan + volgend punt</button>` : ""}`, () => {
      fillThumbs(sheet);
      const keep = () => { p.vak = $("#pV").value.trim(); p.diepte = $("#pD").value; p.rhon = $("#pR").value; p.opm = $("#pO").value; if (p.monster !== "") p.monster = $("#pMn") ? $("#pMn").value.trim() : p.monster; };
      $$("#pM button").forEach(b => b.onclick = () => { keep(); const on = b.dataset.v === "1"; p.monster = on ? ($("#pMn").value.trim() || p.nr + "a") : ""; $$("#pM button").forEach(x => x.classList.toggle("on", x === b)); $("#pMon").classList.toggle("hidden", !on); });
      $$("#pVo button").forEach(b => b.onclick = () => { p.voor = b.dataset.v; $$("#pVo button").forEach(x => x.classList.toggle("on", x === b)); });
      const gps = async () => { gpsTried = true; try { const pos = await getPos({ maximumAge: 0 }); Object.assign(p, { lat: pos.lat, lng: pos.lng, acc: pos.acc }); } catch (e) { } const g = $("#kGps"); if (g) g.firstChild.textContent = typeof p.lat === "number" ? `GPS ${fmtLL(p.lat, p.lng)} ±${Math.round(p.acc || 0)} m ` : "Geen GPS-positie "; };
      $("#kG").onclick = () => { $("#kGps").firstChild.textContent = "GPS zoeken… "; gps(); };
      if (!gpsTried) gps();
      $("#pCam").onclick = () => { keep(); pendingPhotoNote = { draft, draw: () => { p.photos = draft.photos; draw(); }, source: "camera" }; $("#camIn").value = ""; $("#camIn").click(); };
      $$("#sheet [data-vp]").forEach(t => t.onclick = () => { keep(); photoViewer(t.dataset.vp, { onRemove: async () => { draft.photos = draft.photos.filter(x => x !== t.dataset.vp); p.photos = draft.photos; await DB.photoDel(t.dataset.vp); draw(); }, onBack: draw }); });
      const commit = () => {
        keep(); if (!p.rhon) { toast("Vul de natte dichtheid in"); return false; }
        p.photos = draft.photos;
        if (isNew) k.points.push(p); else k.points[idx] = p;
        if (!m.steps.gemeten) m.steps.gemeten = nowISO();
        save(); return true;
      };
      $("#pOk").onclick = () => { if (commit()) { closeSheet(); render(); } };
      if ($("#pNext")) $("#pNext").onclick = () => { if (commit()) { render(); kdPointSheet(m, -1); } };
      if ($("#pX")) $("#pX").onclick = async () => { for (const id of draft.photos) await DB.photoDel(id); closeSheet(); };
      if ($("#pDel")) $("#pDel").onclick = () => confirmSheet(`meetpunt ${p.nr}`, async () => { for (const id of k.points[idx].photos) await DB.photoDel(id); k.points.splice(idx, 1); k.points.forEach((x, i) => x.nr = i + 1); save(); closeSheet(); render(); }, "De volgende punten schuiven een nummer op.");
    });
  };
  draw();
}

/* ---------- Excel-sjabloon invullen ---------- */
async function unzipXlsx(blob) {
  const u8 = new Uint8Array(await blob.arrayBuffer()), dv = new DataView(u8.buffer);
  let e = u8.length - 22; while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new Error("geen Excel-bestand");
  const n = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true);
  const td = new TextDecoder(), out = [];
  for (let i = 0; i < n; i++) {
    const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lho = dv.getUint32(p + 42, true);
    const name = td.decode(u8.subarray(p + 46, p + 46 + nl)); p += 46 + nl + xl + cl;
    const start = lho + 30 + dv.getUint16(lho + 26, true) + dv.getUint16(lho + 28, true);
    const comp = u8.subarray(start, start + csize);
    let data;
    if (method === 0) data = comp.slice();
    else if (method === 8) data = new Uint8Array(await new Response(new Blob([comp]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer());
    else throw new Error("onbekende compressie");
    out.push({ name, data });
  }
  return out;
}
const fileText = (files, n) => { const f = files.find(x => x.name === n); return f ? new TextDecoder().decode(f.data) : null; };
const unXml = s => s.replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
function sheetMap(files) {
  const wb = fileText(files, "xl/workbook.xml"), rels = fileText(files, "xl/_rels/workbook.xml.rels") || "";
  const tgt = {}; for (const r of rels.matchAll(/<Relationship\b[^>]*>/g)) { const id = (r[0].match(/Id="([^"]+)"/) || [])[1], t = (r[0].match(/Target="([^"]+)"/) || [])[1]; if (id && t) tgt[id] = t; }
  return [...wb.matchAll(/<sheet\b[^>]*>/g)].map(s => {
    const name = unXml((s[0].match(/name="([^"]*)"/) || [])[1] || ""), rid = (s[0].match(/r:id="([^"]+)"/) || [])[1];
    let t = tgt[rid] || ""; t = t.startsWith("/") ? t.slice(1) : "xl/" + t;
    return { name, path: t };
  });
}
const colNum = c => [...c].reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0);
const xmlE = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function setCellXml(xml, ref, val) {
  const col = ref.match(/[A-Z]+/)[0], row = +ref.match(/\d+/)[0];
  const cellRe = new RegExp(`<c r="${ref}"((?:\\s[^>]*?)?)(\\/>|>[\\s\\S]*?<\\/c>)`);
  const m = xml.match(cellRe);
  let s = ""; if (m) { const sm = m[1].match(/\ss="(\d+)"/); if (sm) s = ` s="${sm[1]}"`; }
  const nc = val === null || val === "" || val === undefined ? `<c r="${ref}"${s}/>` : typeof val === "number" ? `<c r="${ref}"${s}><v>${val}</v></c>` : `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${xmlE(val)}</t></is></c>`;
  if (m) return xml.replace(cellRe, nc);
  const rowRe = new RegExp(`<row r="${row}"((?:\\s[^>]*?)?)(\\/>|>([\\s\\S]*?)<\\/row>)`);
  const rm = xml.match(rowRe);
  if (rm) {
    if (rm[2] === "/>") return xml.replace(rowRe, `<row r="${row}"${rm[1]}>${nc}</row>`);
    const inner = rm[3]; let pos = inner.length;
    for (const c of inner.matchAll(/<c r="([A-Z]+)\d+"/g)) if (colNum(c[1]) > colNum(col)) { pos = c.index; break; }
    return xml.replace(rowRe, () => `<row r="${row}"${rm[1]}>${inner.slice(0, pos)}${nc}${inner.slice(pos)}</row>`);
  }
  const nr = `<row r="${row}">${nc}</row>`;
  for (const r of xml.matchAll(/<row r="(\d+)"/g)) if (+r[1] > row) return xml.slice(0, r.index) + nr + xml.slice(r.index);
  if (xml.includes("<sheetData/>")) return xml.replace("<sheetData/>", `<sheetData>${nr}</sheetData>`);
  return xml.replace("</sheetData>", nr + "</sheetData>");
}
const excelDate = k => { const [y, mo, d] = k.split("-").map(Number); return Math.round((Date.UTC(y, mo - 1, d) - Date.UTC(1899, 11, 30)) / 864e5); };
const numOr = v => { const n = parseFloat(String(v).replace(",", ".")); return isFinite(n) ? n : (v || ""); };
async function kdExport(m) {
  const k = m.kd;
  let tpl = null; try { tpl = await DB.get("kdTemplate"); } catch (e) { }
  if (!tpl) return openSheet(`<h3>Sjabloon ontbreekt</h3><p class="lead">Laad eerst het lege Excel-sjabloon in via Instellingen → Kwaliteitsdienst.</p><div class="actions"><button class="btn ghost" data-act="close">Sluit</button><button class="btn" data-act="settings">Naar instellingen</button></div>`);
  if (!k.points.length) return toast("Nog geen meetpunten");
  toast("Excel maken…");
  try {
    const files = await unzipXlsx(tpl), sheets = sheetMap(files);
    const edits = {}; // path -> [[ref,val]]
    const put = (sheetName, ref, val) => { const sh = sheets.find(s => s.name.trim() === sheetName); if (!sh) return false; (edits[sh.path] = edits[sh.path] || []).push([ref, val]); return true; };
    put("Voorblad", "D6", k.opdrachtgever); put("Voorblad", "D7", k.tav); put("Voorblad", "B14", k.project); put("Voorblad", "B15", k.locatie);
    put("Voorblad", "B18", k.klantnr); if (k.datum) put("Voorblad", "B20", excelDate(k.datum));
    const p8 = ["Invoer proef 8", "Invoer proef 8 (2)", "Invoer proef 8 (3)"], cols = "BCDEFGHIJK";
    let skipped = 0;
    k.points.forEach((p, i) => {
      const sh = p8[Math.floor(i / 10)], c = cols[i % 10];
      if (!sh || !sheets.some(s => s.name.trim() === sh)) { skipped++; return; }
      put(sh, c + "6", p.vak); put(sh, c + "9", numOr(p.diepte)); put(sh, c + "10", numOr(p.rhon));
    });
    const mpd = k.points.filter(p => p.monster && p.voor === "MPD"), epd = k.points.filter(p => p.monster && p.voor === "EPD");
    mpd.slice(0, 4).forEach((p, i) => { put(`MPD-Inv ${i + 1}`, "I17", p.monster); put(`MPD-Inv ${i + 1}`, "E17", k.materiaal); });
    epd.slice(0, 4).forEach((p, i) => { put(`EPD - Invoer ${i + 1}`, "F3", p.monster); put(`EPD - Invoer ${i + 1}`, "C5", k.materiaal); });
    const enc = new TextEncoder();
    for (const f of files) {
      if (edits[f.name]) { let x = new TextDecoder().decode(f.data); for (const [ref, val] of edits[f.name]) x = setCellXml(x, ref, val); f.data = enc.encode(x); }
      if (f.name === "xl/workbook.xml") {
        let x = new TextDecoder().decode(f.data);
        x = /<calcPr\b[^>]*\/>/.test(x) ? x.replace(/<calcPr\b([^>]*?)\s*\/>/, (a, attrs) => `<calcPr${attrs.replace(/\sfullCalcOnLoad="[^"]*"/, "")} fullCalcOnLoad="1"/>`) : x.replace("</workbook>", `<calcPr fullCalcOnLoad="1"/></workbook>`);
        f.data = enc.encode(x);
      }
    }
    const xz = new VWLib.Zip(); files.forEach(f => xz.add(f.name, f.data)); const xblob = await xz.blob("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    const d = k.datum ? k.datum.split("-").reverse().join("-") : "";
    const base = fnSafe(`${k.klantnr}_Rapportage_${k.locatie}_${k.project}_${d}`).replace(/\s+/g, "_");
    const allPh = k.points.flatMap(p => p.photos);
    if (!allPh.length) { deliver(xblob, base + ".xlsx"); }
    else {
      const z = new VWLib.Zip(); z.add(base + ".xlsx", xblob);
      const csv = [["punt", "vak", "diepte_cm", "rho_n", "monster", "voor", "lat", "lon", "nauwkeurigheid_m", "opmerking"].join(";")];
      for (const p of k.points) {
        csv.push([p.nr, p.vak, p.diepte, p.rhon, p.monster, p.monster ? p.voor : "", p.lat ?? "", p.lng ?? "", p.acc ? Math.round(p.acc) : "", p.opm].map(x => `"${String(x ?? "").replace(/"/g, '""')}"`).join(";"));
        let j = 0;
        for (const id of p.photos) { const ph = await DB.photoGet(id); if (!ph) continue; j++; z.add(`Fotos/Punt_${pad(p.nr)}${p.photos.length > 1 ? "_" + j : ""}.jpg`, await photoWithGps(ph), new Date(ph.taken)); }
      }
      z.add("Meetpunten.csv", "﻿" + csv.join("\r\n"));
      deliver(await z.blob(), base + ".zip");
    }
    if (skipped) toast(`${skipped} meetpunt(en) passen niet in het sjabloon (max 30)`);
  } catch (e) { console.error(e); toast("Export mislukt: " + e.message); }
}
if (DB.db) render();

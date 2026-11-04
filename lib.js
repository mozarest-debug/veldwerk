/* Veldwerk – hulpbibliotheek zonder externe afhankelijkheden:
   ZIP-schrijver, minimale XLSX-schrijver, EXIF GPS lezen/schrijven voor JPEG. */
(function (global) {
  "use strict";

  /* ---------- CRC32 + ZIP (store, geen compressie) ---------- */
  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(u8) {
    let c = 0xffffffff;
    for (let i = 0; i < u8.length; i++) c = CRC_TABLE[(c ^ u8[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  const enc = new TextEncoder();
  function toU8(data) {
    if (data instanceof Uint8Array) return Promise.resolve(data);
    if (typeof data === "string") return Promise.resolve(enc.encode(data));
    if (data instanceof ArrayBuffer) return Promise.resolve(new Uint8Array(data));
    if (data && typeof data.arrayBuffer === "function") return data.arrayBuffer().then(b => new Uint8Array(b));
    return Promise.resolve(new Uint8Array(0));
  }
  function dosTime(d) {
    return {
      time: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
      date: ((Math.max(1980, d.getFullYear()) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()
    };
  }
  class Zip {
    constructor() { this.files = []; }
    add(path, data, date) { this.files.push({ path, data, date: date || new Date() }); }
    async blob(mime) {
      const parts = [], central = [];
      let offset = 0;
      for (const f of this.files) {
        const data = await toU8(f.data);
        const name = enc.encode(f.path);
        const crc = crc32(data);
        const { time, date } = dosTime(f.date);
        const lh = new DataView(new ArrayBuffer(30));
        lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true);
        lh.setUint16(8, 0, true); lh.setUint16(10, time, true); lh.setUint16(12, date, true);
        lh.setUint32(14, crc, true); lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true);
        lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
        parts.push(new Uint8Array(lh.buffer), name, data);
        const ch = new DataView(new ArrayBuffer(46));
        ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true);
        ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true); ch.setUint16(12, time, true);
        ch.setUint16(14, date, true); ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true);
        ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true);
        ch.setUint32(42, offset, true);
        central.push(new Uint8Array(ch.buffer), name);
        offset += 30 + name.length + data.length;
      }
      const cdSize = central.reduce((s, p) => s + p.length, 0);
      const end = new DataView(new ArrayBuffer(22));
      end.setUint32(0, 0x06054b50, true);
      end.setUint16(8, this.files.length, true); end.setUint16(10, this.files.length, true);
      end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
      return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: mime || "application/zip" });
    }
  }

  /* ---------- Minimale XLSX ---------- */
  const xmlEsc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
  function colName(i) { let s = ""; i++; while (i) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
  // sheets: [{name, rows:[[cell,...]], widths:[..]}]; een cel is string, number, of {v:number, s:"num2"} / {v, s:"bold"}
  async function xlsx(sheets) {
    const z = new Zip();
    const safeName = n => String(n).replace(/[\\\/\?\*\[\]:]/g, " ").slice(0, 31) || "Blad";
    z.add("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((s, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`);
    z.add("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
    z.add("xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${xmlEsc(safeName(s.name))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`);
    z.add("xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((s, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
    // stijlen: 0 normaal, 1 vet, 2 getal 0.00, 3 vet getal 0.00
    z.add("xl/styles.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="0.00"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="164" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`);
    sheets.forEach((s, si) => {
      const styleId = st => st === "bold" ? 1 : st === "num2" ? 2 : st === "boldnum2" ? 3 : 0;
      const rows = s.rows.map((r, ri) => `<row r="${ri + 1}">${r.map((c, ci) => {
        if (c === null || c === undefined || c === "") return "";
        const ref = colName(ci) + (ri + 1);
        let v = c, st = 0;
        if (typeof c === "object") { v = c.v; st = styleId(c.s); }
        if (typeof v === "number" && isFinite(v)) return `<c r="${ref}" s="${st}"><v>${v}</v></c>`;
        return `<c r="${ref}" s="${st}" t="inlineStr"><is><t xml:space="preserve">${xmlEsc(v)}</t></is></c>`;
      }).join("")}</row>`).join("");
      const cols = s.widths ? `<cols>${s.widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>` : "";
      z.add(`xl/worksheets/sheet${si + 1}.xml`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${cols}<sheetData>${rows}</sheetData></worksheet>`);
    });
    return z.blob("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  }

  /* ---------- EXIF (JPEG) ---------- */
  // Zoekt het APP1-Exif segment. Geeft {start, len, tiff} (tiff = offset van TIFF-header in bestand) of null.
  function findExif(u8) {
    if (u8[0] !== 0xff || u8[1] !== 0xd8) return { jpeg: false };
    let p = 2;
    while (p + 4 < u8.length) {
      if (u8[p] !== 0xff) return { jpeg: true, exif: null, insertAt: 2 };
      const marker = u8[p + 1];
      if (marker === 0xda || marker === 0xd9) break; // start of scan
      const len = (u8[p + 2] << 8) | u8[p + 3];
      if (marker === 0xe1 && u8[p + 4] === 0x45 && u8[p + 5] === 0x78 && u8[p + 6] === 0x69 && u8[p + 7] === 0x66 && u8[p + 8] === 0 && u8[p + 9] === 0) {
        return { jpeg: true, exif: { start: p, len: len, tiff: p + 10 } };
      }
      p += 2 + len;
    }
    // na APP0 (JFIF) invoegen indien aanwezig
    let ins = 2;
    if (u8[2] === 0xff && u8[3] === 0xe0) ins = 4 + ((u8[4] << 8) | u8[5]);
    return { jpeg: true, exif: null, insertAt: ins };
  }
  function reader(u8, tiff) {
    const le = u8[tiff] === 0x49;
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    return {
      le,
      u16: o => dv.getUint16(tiff + o, le),
      u32: o => dv.getUint32(tiff + o, le),
      ifd(o) {
        const n = dv.getUint16(tiff + o, le), e = [];
        for (let i = 0; i < n; i++) {
          const b = o + 2 + i * 12;
          e.push({ tag: dv.getUint16(tiff + b, le), type: dv.getUint16(tiff + b + 2, le), count: dv.getUint32(tiff + b + 4, le), raw: u8.slice(tiff + b, tiff + b + 12), vo: b + 8 });
        }
        return { entries: e, next: dv.getUint32(tiff + o + 2 + n * 12, le) };
      }
    };
  }
  function readRational(r, off) { const a = r.u32(off), b = r.u32(off + 4); return b ? a / b : 0; }
  function readAscii(u8, tiff, r, e) {
    const off = e.count <= 4 ? e.vo : r.u32(e.vo);
    let s = "";
    for (let i = 0; i < e.count - 1; i++) s += String.fromCharCode(u8[tiff + off + i]);
    return s;
  }
  // Leest GPS + DateTimeOriginal uit een JPEG. Geeft {lat,lng,taken} (velden kunnen ontbreken).
  function readExif(u8) {
    try {
      const f = findExif(u8);
      if (!f.jpeg || !f.exif) return {};
      const t = f.exif.tiff, r = reader(u8, t);
      const ifd0 = r.ifd(r.u32(4));
      const out = {};
      const gpsE = ifd0.entries.find(e => e.tag === 0x8825);
      if (gpsE) {
        const g = r.ifd(r.u32(gpsE.vo)).entries;
        const get = tag => g.find(e => e.tag === tag);
        const la = get(2), laR = get(1), lo = get(4), loR = get(3);
        if (la && lo) {
          const dms = e => { const o = r.u32(e.vo); return readRational(r, o) + readRational(r, o + 8) / 60 + readRational(r, o + 16) / 3600; };
          let lat = dms(la), lng = dms(lo);
          if (laR && String.fromCharCode(u8[t + laR.vo]) === "S") lat = -lat;
          if (loR && String.fromCharCode(u8[t + loR.vo]) === "W") lng = -lng;
          if (lat || lng) { out.lat = lat; out.lng = lng; }
        }
      }
      const exE = ifd0.entries.find(e => e.tag === 0x8769);
      if (exE) {
        const dto = r.ifd(r.u32(exE.vo)).entries.find(e => e.tag === 0x9003);
        if (dto) {
          const s = readAscii(u8, t, r, dto); // "YYYY:MM:DD HH:MM:SS"
          const m = s.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
          if (m) out.taken = new Date(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +m[6]).toISOString();
        }
      }
      return out;
    } catch (e) { return {}; }
  }

  // Bouwt een GPS-IFD (big endian waarden worden via writer bepaald)
  function writer(le) {
    const bytes = [];
    const w = {
      bytes,
      u8(v) { bytes.push(v & 255); },
      u16(v) { if (le) bytes.push(v & 255, (v >> 8) & 255); else bytes.push((v >> 8) & 255, v & 255); },
      u32(v) { v >>>= 0; if (le) bytes.push(v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >>> 24) & 255); else bytes.push((v >>> 24) & 255, (v >> 16) & 255, (v >> 8) & 255, v & 255); },
      pos() { return bytes.length; },
      set32(at, v) { v >>>= 0; const b = le ? [v & 255, (v >> 8) & 255, (v >> 16) & 255, v >>> 24] : [v >>> 24, (v >> 16) & 255, (v >> 8) & 255, v & 255]; for (let i = 0; i < 4; i++) bytes[at + i] = b[i]; }
    };
    return w;
  }
  function dmsRationals(deg) {
    deg = Math.abs(deg);
    const d = Math.floor(deg), mf = (deg - d) * 60, m = Math.floor(mf), s = Math.round((mf - m) * 60 * 10000);
    return [[d, 1], [m, 1], [s, 10000]];
  }
  // Schrijft een GPS-IFD op basis 'base' (offset t.o.v. TIFF-start). Geeft byte-array.
  function gpsIfdBytes(le, base, lat, lng, alt, when) {
    const w = writer(le);
    const entries = [];
    entries.push({ tag: 0, type: 1, count: 4, inline: [2, 3, 0, 0] }); // GPSVersionID
    entries.push({ tag: 1, type: 2, count: 2, inline: [lat < 0 ? 83 : 78, 0, 0, 0] }); // N/S
    entries.push({ tag: 2, type: 5, count: 3, rat: dmsRationals(lat) });
    entries.push({ tag: 3, type: 2, count: 2, inline: [lng < 0 ? 87 : 69, 0, 0, 0] }); // E/W
    entries.push({ tag: 4, type: 5, count: 3, rat: dmsRationals(lng) });
    if (typeof alt === "number" && isFinite(alt)) {
      entries.push({ tag: 5, type: 1, count: 1, inline: [alt < 0 ? 1 : 0, 0, 0, 0] });
      entries.push({ tag: 6, type: 5, count: 1, rat: [[Math.round(Math.abs(alt) * 100), 100]] });
    }
    if (when) {
      const d = new Date(when);
      entries.push({ tag: 7, type: 5, count: 3, rat: [[d.getUTCHours(), 1], [d.getUTCMinutes(), 1], [d.getUTCSeconds(), 1]] });
      const ds = `${d.getUTCFullYear()}:${String(d.getUTCMonth() + 1).padStart(2, "0")}:${String(d.getUTCDate()).padStart(2, "0")}\0`;
      entries.push({ tag: 29, type: 2, count: 11, ascii: ds });
    }
    const n = entries.length;
    const dataStart = base + 2 + n * 12 + 4;
    let dataOff = dataStart;
    const data = [];
    w.u16(n);
    for (const e of entries) {
      w.u16(e.tag); w.u16(e.type); w.u32(e.count);
      if (e.inline) { e.inline.forEach(b => w.u8(b)); }
      else if (e.rat) { w.u32(dataOff); const dw = writer(le); e.rat.forEach(([a, b]) => { dw.u32(a); dw.u32(b); }); data.push(...dw.bytes); dataOff += e.rat.length * 8; }
      else if (e.ascii) { w.u32(dataOff); const ab = [...e.ascii].map(c => c.charCodeAt(0)); data.push(...ab); dataOff += ab.length; if (ab.length % 2) { data.push(0); dataOff++; } }
    }
    w.u32(0);
    return w.bytes.concat(data);
  }
  function dateTimeStr(iso) {
    const d = new Date(iso), p = n => String(n).padStart(2, "0");
    return `${d.getFullYear()}:${p(d.getMonth() + 1)}:${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}\0`;
  }
  // Voegt GPS toe aan een JPEG als die nog geen GPS heeft. Bestaande metadata blijft behouden.
  // meta: {lat,lng,alt,taken}. Geeft nieuwe Uint8Array (of de originele als niets nodig/mogelijk is).
  function addGps(u8, meta) {
    try {
      if (typeof meta.lat !== "number" || typeof meta.lng !== "number") return u8;
      const f = findExif(u8);
      if (!f.jpeg) return u8;
      if (f.exif) {
        const t = f.exif.tiff, r = reader(u8, t), le = r.le;
        const ifd0Off = r.u32(4);
        const ifd0 = r.ifd(ifd0Off);
        if (ifd0.entries.some(e => e.tag === 0x8825)) return u8; // heeft al GPS
        const segEnd = f.exif.start + 2 + f.exif.len; // einde van APP1
        const tiffLen = segEnd - t;
        // nieuw IFD0 achteraan de TIFF-data, GPS-IFD daarna
        let newIfd0Off = tiffLen + (tiffLen % 2);
        const newEntriesCount = ifd0.entries.length + 1;
        const gpsOff = newIfd0Off + 2 + newEntriesCount * 12 + 4;
        const w = writer(le);
        w.u16(newEntriesCount);
        const all = ifd0.entries.map(e => ({ tag: e.tag, raw: e.raw }));
        const gw = writer(le); gw.u16(0x8825); gw.u16(4); gw.u32(1); gw.u32(gpsOff);
        all.push({ tag: 0x8825, raw: new Uint8Array(gw.bytes) });
        all.sort((a, b) => a.tag - b.tag);
        all.forEach(e => e.raw.forEach(b => w.u8(b)));
        w.u32(ifd0.next);
        const gps = gpsIfdBytes(le, gpsOff, meta.lat, meta.lng, meta.alt, meta.taken);
        const add = (tiffLen % 2 ? [0] : []).concat(w.bytes, gps);
        const newLen = f.exif.len + add.length;
        if (newLen > 65533) return u8;
        const out = new Uint8Array(u8.length + add.length);
        out.set(u8.subarray(0, segEnd), 0);
        out.set(add, segEnd);
        out.set(u8.subarray(segEnd), segEnd + add.length);
        out[f.exif.start + 2] = (newLen >> 8) & 255; out[f.exif.start + 3] = newLen & 255;
        // TIFF-header: offset IFD0 aanpassen
        const hdr = writer(le); hdr.u32(newIfd0Off);
        out.set(hdr.bytes, t + 4);
        return out;
      }
      // geen EXIF: nieuw APP1 maken (big endian "MM")
      const le = false;
      const hasTime = !!meta.taken;
      const n0 = hasTime ? 3 : 1; // DateTime(0x0132), ExifIFD(0x8769), GPS(0x8825)
      const ifd0Off = 8;
      let p = ifd0Off + 2 + n0 * 12 + 4;
      const dtOff = p; if (hasTime) p += 20;
      const exifOff = p; if (hasTime) p += 2 + 12 + 4 + 20;
      const gpsOff = p;
      const w = writer(le);
      w.u8(0x4d); w.u8(0x4d); w.u16(42); w.u32(ifd0Off);
      w.u16(n0);
      if (hasTime) { w.u16(0x0132); w.u16(2); w.u32(20); w.u32(dtOff); }
      if (hasTime) { w.u16(0x8769); w.u16(4); w.u32(1); w.u32(exifOff); }
      w.u16(0x8825); w.u16(4); w.u32(1); w.u32(gpsOff);
      w.u32(0);
      if (hasTime) {
        const ds = dateTimeStr(meta.taken); [...ds].forEach(c => w.u8(c.charCodeAt(0)));
        w.u16(1); w.u16(0x9003); w.u16(2); w.u32(20); w.u32(exifOff + 2 + 12 + 4); w.u32(0);
        [...ds].forEach(c => w.u8(c.charCodeAt(0)));
      }
      const gps = gpsIfdBytes(le, gpsOff, meta.lat, meta.lng, meta.alt, meta.taken);
      const tiff = w.bytes.concat(gps);
      const segLen = 2 + 6 + tiff.length;
      const head = [0xff, 0xe1, (segLen >> 8) & 255, segLen & 255, 0x45, 0x78, 0x69, 0x66, 0, 0];
      const ins = f.insertAt;
      const out = new Uint8Array(u8.length + head.length + tiff.length);
      out.set(u8.subarray(0, ins), 0);
      out.set(head, ins);
      out.set(tiff, ins + head.length);
      out.set(u8.subarray(ins), ins + head.length + tiff.length);
      return out;
    } catch (e) { return u8; }
  }

  global.VWLib = { Zip, xlsx, readExif, addGps, crc32 };
})(window);

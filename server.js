'use strict';
/* Mustika Gamers: server game online.
   - POST /api/login      : cek kata sandi di server, beri token sementara
   - WebSocket /ws?token= : posisi pemain, chat, dan sinyal WebRTC (kamera/suara)
   - File statis dari folder public/ */
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
const PASS = process.env.GAME_PASSWORD || 'karuhun83';
const PUB = path.join(__dirname, 'public');
const ICE = [{ urls: 'stun:stun.l.google.com:19302' }];
if (process.env.TURN_URL) ICE.push({ urls: process.env.TURN_URL, username: process.env.TURN_USER || '', credential: process.env.TURN_PASS || '' });

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json' };
const sha = s => crypto.createHash('sha256').update(s).digest();
const passHash = sha(PASS);
const tokens = new Map();           // token -> kedaluwarsa
const fails = new Map();            // ip -> {n, t}
const ipOf = req => String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
const json = (res, code, obj) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/api/login') {
    let body = '';
    req.on('data', c => { body += c; if (body.length > 1024) req.destroy(); });
    req.on('end', () => {
      const ip = ipOf(req), f = fails.get(ip);
      if (f && f.n >= 5 && Date.now() - f.t < 60000) return json(res, 429, { ok: false, error: 'Terlalu banyak percobaan. Tunggu 1 menit.' });
      let pw = ''; try { pw = String(JSON.parse(body).password || ''); } catch (e) {}
      if (!crypto.timingSafeEqual(sha(pw), passHash)) {
        const g = fails.get(ip) || { n: 0, t: 0 };
        g.n = (Date.now() - g.t > 60000 ? 0 : g.n) + 1; g.t = Date.now(); fails.set(ip, g);
        return json(res, 401, { ok: false, error: 'Kata sandi salah. Coba lagi.' });
      }
      fails.delete(ip);
      const token = crypto.randomBytes(24).toString('hex');
      tokens.set(token, Date.now() + 12 * 3600e3);
      json(res, 200, { ok: true, token, ice: ICE });
    });
    return;
  }
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(PUB, p));
  if (!file.startsWith(PUB)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Tidak ditemukan'); }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'x-content-type-options': 'nosniff' });
    res.end(data);
  });
});

const wss = new WebSocketServer({ noServer: true, maxPayload: 32768 });
server.on('upgrade', (req, sock, head) => {
  const u = new URL(req.url, 'http://x');
  const exp = tokens.get(u.searchParams.get('token'));
  if (u.pathname !== '/ws' || !exp || exp < Date.now()) { sock.write('HTTP/1.1 401 Unauthorized\r\n\r\n'); sock.destroy(); return; }
  wss.handleUpgrade(req, sock, head, ws => wss.emit('connection', ws, req));
});

const MODES = new Set(['menu', 'gang', 'rumah', 'kopdes', 'hidup', 'pancing', 'topi', 'lempar', 'kebun']);
const clean = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f<>]/g, '').slice(0, n);
const clampN = v => (typeof v === 'number' && isFinite(v)) ? Math.max(-200, Math.min(200, v)) : null;
const clients = new Map(); let nextId = 1, dirty = false;

wss.on('connection', ws => {
  const id = String(nextId++);
  const c = { ws, p: { mode: 'menu' }, chatT: 0, msgs: 0, msgT: Date.now(), alive: true };
  clients.set(id, c); dirty = true;
  ws.send(JSON.stringify({ t: 'hello', id }));
  ws.on('pong', () => { c.alive = true; });
  ws.on('message', buf => {
    const now = Date.now();
    if (now - c.msgT > 1000) { c.msgT = now; c.msgs = 0; }
    if (++c.msgs > 60) return;
    let m; try { m = JSON.parse(buf.toString()); } catch (e) { return; }
    if (!m || typeof m.t !== 'string') return;
    if (m.t === 'presence' && m.p && typeof m.p === 'object') {
      const p = m.p, q = c.p;
      if ('n' in p) q.n = clean(p.n, 16);
      if ('k' in p) q.k = clean(p.k, 3);
      if ('g' in p) q.g = p.g === 'P' ? 'P' : 'L';
      if ('c' in p) q.c = clean(p.c, 12);
      if ('mode' in p && MODES.has(p.mode)) q.mode = p.mode;
      for (const k of ['x', 'z', 'ry']) if (k in p) { const v = p[k] === null ? null : clampN(p[k]); if (v === null) delete q[k]; else q[k] = v; }
      if ('e' in p) q.e = clean(p.e, 8);
      if ('et' in p && typeof p.et === 'number') q.et = p.et;
      dirty = true;
    } else if (m.t === 'chat' && m.data) {
      if (now - c.chatT < 600) return; c.chatT = now;
      const t = clean(m.data.t, 80); if (!t) return;
      const out = JSON.stringify({ t: 'chat', data: { n: c.p.n || 'Pemain', t, m: c.p.mode } });
      for (const [i, o] of clients) if (i !== id && o.p.mode === c.p.mode && o.ws.readyState === 1) o.ws.send(out);
    } else if (m.t === 'sig') {
      const o = clients.get(String(m.to));
      const s = JSON.stringify(m.data || {});
      if (o && o !== c && c.p.mode !== 'menu' && o.p.mode === c.p.mode && o.ws.readyState === 1 && s.length < 20000)
        o.ws.send(JSON.stringify({ t: 'sig', from: id, data: m.data }));
    }
  });
  ws.on('close', () => { clients.delete(id); dirty = true; });
});

setInterval(() => {   // siarkan posisi semua pemain 10x per detik bila ada perubahan
  if (!dirty) return; dirty = false;
  const s = JSON.stringify({ t: 'peers', peers: [...clients].map(([id, c]) => ({ id, p: c.p })) });
  for (const c of clients.values()) if (c.ws.readyState === 1) c.ws.send(s);
}, 100);
setInterval(() => {   // buang koneksi mati dan token kedaluwarsa
  for (const [id, c] of clients) { if (!c.alive) { c.ws.terminate(); clients.delete(id); dirty = true; continue; } c.alive = false; c.ws.ping(); }
  for (const [t, e] of tokens) if (e < Date.now()) tokens.delete(t);
}, 30000);

server.listen(PORT, () => console.log('Mustika Gamers berjalan di http://localhost:' + PORT));

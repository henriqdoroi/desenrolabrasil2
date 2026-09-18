import crypto from 'node:crypto';

const COOKIE = 'adm_sess';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function secret() {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (!s) throw new Error('ADMIN_SESSION_SECRET nao configurado');
  return s;
}

function sign(payload) {
  return crypto.createHmac('sha256', secret()).update(payload).digest('hex');
}

export function issueCookie(email) {
  const expires = Date.now() + MAX_AGE_MS;
  const payload = `${email}|${expires}`;
  const sig = sign(payload);
  const value = `${payload}|${sig}`;
  const maxAgeSec = Math.floor(MAX_AGE_MS / 1000);
  return `${COOKIE}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSec}; HttpOnly; Secure; SameSite=Lax`;
}

export function clearCookie() {
  return `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

function parseCookie(header) {
  if (!header) return {};
  return header.split(';').reduce((acc, part) => {
    const i = part.indexOf('=');
    if (i < 0) return acc;
    const k = part.slice(0, i).trim();
    const v = decodeURIComponent(part.slice(i + 1).trim());
    acc[k] = v;
    return acc;
  }, {});
}

export function readSession(req) {
  try {
    const raw = parseCookie(req.headers.cookie)[COOKIE];
    if (!raw) return null;
    const parts = raw.split('|');
    if (parts.length !== 3) return null;
    const [email, expiresStr, sig] = parts;
    const expires = Number(expiresStr);
    if (!expires || Date.now() > expires) return null;
    const expected = sign(`${email}|${expiresStr}`);
    const a = Buffer.from(sig, 'hex');
    const b = Buffer.from(expected, 'hex');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    return { email, expires };
  } catch {
    return null;
  }
}

export function requireAdmin(req, res) {
  const s = readSession(req);
  if (!s || s.email !== process.env.ADMIN_EMAIL) {
    res.status(401).json({ error: 'nao autorizado' });
    return null;
  }
  return s;
}

export function checkCredentials(email, password) {
  const em = String(process.env.ADMIN_EMAIL || '');
  const pw = String(process.env.ADMIN_PASSWORD || '');
  if (!em || !pw) return false;
  const inEmail = String(email || '');
  const inPass = String(password || '');
  const okEmail = inEmail.length === em.length && crypto.timingSafeEqual(Buffer.from(inEmail), Buffer.from(em));
  const okPass = inPass.length === pw.length && crypto.timingSafeEqual(Buffer.from(inPass), Buffer.from(pw));
  return okEmail && okPass;
}

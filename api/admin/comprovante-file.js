import { Buffer } from 'node:buffer';
import { sql, ensureSchema } from '../../lib/db.js';
import { requireAdmin } from '../../lib/auth.js';

function toBuffer(v) {
  if (Buffer.isBuffer(v)) return v;
  if (v instanceof Uint8Array) return Buffer.from(v.buffer, v.byteOffset, v.byteLength);
  if (v && typeof v === 'object' && v.type === 'Buffer' && Array.isArray(v.data)) return Buffer.from(v.data);
  if (typeof v === 'string') {
    if (v.startsWith('\\x')) return Buffer.from(v.slice(2), 'hex');
    return Buffer.from(v, 'binary');
  }
  return Buffer.from(v);
}

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  const id = parseInt(req.query.id);
  if (!id) { res.status(400).json({ error: 'id invalido' }); return; }
  try {
    await ensureSchema();
    const s = sql();
    const rows = await s`SELECT file_name, mime_type, data FROM comprovantes WHERE id = ${id} LIMIT 1`;
    if (!rows.length) { res.status(404).json({ error: 'nao encontrado' }); return; }
    const row = rows[0];
    const buf = toBuffer(row.data);
    const asDownload = req.query.download === '1';
    const dispo = asDownload ? 'attachment' : 'inline';
    const safeName = String(row.file_name || 'comprovante').replace(/["\\]/g, '_');
    res.statusCode = 200;
    res.setHeader('Content-Type', row.mime_type || 'application/octet-stream');
    res.setHeader('Content-Length', String(buf.length));
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Content-Disposition', `${dispo}; filename="${safeName}"`);
    res.end(buf);
  } catch (e) {
    console.error('comprovante-file:', e && e.message ? e.message : e);
    if (!res.headersSent) res.status(500).json({ error: 'erro interno' });
  }
}

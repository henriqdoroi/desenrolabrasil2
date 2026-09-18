import crypto from 'node:crypto';
import { sql, ensureSchema } from '../../lib/db.js';

export const config = {
  api: {
    bodyParser: false
  }
};

async function readRaw(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks);
}

function verifySignature(header, timestampBody) {
  const secret = process.env.BRAVOPAY_WEBHOOK_SECRET;
  if (!secret || !header) return null;
  try {
    const parts = String(header).split(',').reduce((acc, p) => {
      const [k, v] = p.split('=');
      if (k && v) acc[k.trim()] = v.trim();
      return acc;
    }, {});
    const sig = parts.v1;
    if (!sig) return false;
    const expected = crypto.createHmac('sha256', secret).update(timestampBody).digest('hex');
    const a = Buffer.from(sig, 'hex');
    const b = Buffer.from(expected, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'metodo nao permitido' });
  }

  try {
    const raw = await readRaw(req);
    const sigHeader = req.headers['bravopay-signature'] || req.headers['x-bravopay-signature'];

    let event;
    try {
      event = JSON.parse(raw.toString('utf8'));
    } catch {
      return res.status(400).json({ error: 'json invalido' });
    }

    const ts = (() => {
      try {
        const parts = String(sigHeader || '').split(',').reduce((acc, p) => {
          const [k, v] = p.split('=');
          if (k && v) acc[k.trim()] = v.trim();
          return acc;
        }, {});
        return parts.t || '';
      } catch { return ''; }
    })();

    const verified = verifySignature(sigHeader, `${ts}.${raw.toString('utf8')}`);
    if (process.env.BRAVOPAY_WEBHOOK_SECRET && verified === false) {
      console.warn('webhook assinatura invalida');
      return res.status(401).json({ error: 'assinatura invalida' });
    }

    const type = event && event.type;
    const data = (event && event.data) || {};
    const id = data.id;
    if (!id) {
      return res.status(200).json({ ok: true, ignored: true });
    }

    await ensureSchema();
    const s = sql();

    const paidAt = type === 'transaction.paid' || data.status === 'PAID'
      ? (data.paid_at ? new Date(data.paid_at) : new Date())
      : null;

    await s`
      INSERT INTO transactions (id, external_reference, status, amount_cents, paid_at)
      VALUES (
        ${id},
        ${data.external_reference || null},
        ${data.status || 'PENDING'},
        ${data.amount_cents || 0},
        ${paidAt}
      )
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        paid_at = COALESCE(EXCLUDED.paid_at, transactions.paid_at),
        external_reference = COALESCE(EXCLUDED.external_reference, transactions.external_reference),
        updated_at = NOW()
    `;

    return res.status(200).json({ ok: true, verified: !!verified });
  } catch (e) {
    console.error('webhook error:', e && e.message ? e.message : e);
    return res.status(500).json({ error: 'erro interno' });
  }
}

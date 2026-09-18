import { sql, ensureSchema } from '../../lib/db.js';
import { requireAdmin } from '../../lib/auth.js';

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  try {
    await ensureSchema();
    const s = sql();
    const status = String(req.query.status || '').toUpperCase();
    const q = String(req.query.q || '').trim();
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);

    let rows;
    if (status && q) {
      rows = await s`
        SELECT t.id, t.external_reference, t.status, t.amount_cents, t.fee_cents, t.net_cents,
               t.customer_name, t.customer_email, t.customer_cpf, t.customer_phone,
               t.acordo, t.created_at, t.paid_at, t.updated_at,
               (SELECT COUNT(*) FROM comprovantes c WHERE c.transaction_id = t.id) AS comprovantes_count
        FROM transactions t
        WHERE t.status = ${status}
          AND (t.customer_name ILIKE ${'%' + q + '%'}
               OR t.customer_cpf ILIKE ${'%' + q + '%'}
               OR t.customer_email ILIKE ${'%' + q + '%'}
               OR t.id ILIKE ${'%' + q + '%'}
               OR t.acordo ILIKE ${'%' + q + '%'})
        ORDER BY t.created_at DESC
        LIMIT ${limit}
      `;
    } else if (status) {
      rows = await s`
        SELECT t.id, t.external_reference, t.status, t.amount_cents, t.fee_cents, t.net_cents,
               t.customer_name, t.customer_email, t.customer_cpf, t.customer_phone,
               t.acordo, t.created_at, t.paid_at, t.updated_at,
               (SELECT COUNT(*) FROM comprovantes c WHERE c.transaction_id = t.id) AS comprovantes_count
        FROM transactions t
        WHERE t.status = ${status}
        ORDER BY t.created_at DESC
        LIMIT ${limit}
      `;
    } else if (q) {
      rows = await s`
        SELECT t.id, t.external_reference, t.status, t.amount_cents, t.fee_cents, t.net_cents,
               t.customer_name, t.customer_email, t.customer_cpf, t.customer_phone,
               t.acordo, t.created_at, t.paid_at, t.updated_at,
               (SELECT COUNT(*) FROM comprovantes c WHERE c.transaction_id = t.id) AS comprovantes_count
        FROM transactions t
        WHERE t.customer_name ILIKE ${'%' + q + '%'}
           OR t.customer_cpf ILIKE ${'%' + q + '%'}
           OR t.customer_email ILIKE ${'%' + q + '%'}
           OR t.id ILIKE ${'%' + q + '%'}
           OR t.acordo ILIKE ${'%' + q + '%'}
        ORDER BY t.created_at DESC
        LIMIT ${limit}
      `;
    } else {
      rows = await s`
        SELECT t.id, t.external_reference, t.status, t.amount_cents, t.fee_cents, t.net_cents,
               t.customer_name, t.customer_email, t.customer_cpf, t.customer_phone,
               t.acordo, t.created_at, t.paid_at, t.updated_at,
               (SELECT COUNT(*) FROM comprovantes c WHERE c.transaction_id = t.id) AS comprovantes_count
        FROM transactions t
        ORDER BY t.created_at DESC
        LIMIT ${limit}
      `;
    }
    return res.status(200).json({ rows });
  } catch (e) {
    console.error('admin/transactions:', e && e.message ? e.message : e);
    return res.status(500).json({ error: 'erro interno' });
  }
}

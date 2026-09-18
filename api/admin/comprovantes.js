import { sql, ensureSchema } from '../../lib/db.js';
import { requireAdmin } from '../../lib/auth.js';

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  try {
    await ensureSchema();
    const s = sql();
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);

    const rows = await s`
      SELECT c.id, c.transaction_id, c.cpf, c.nome, c.acordo,
             c.file_name, c.mime_type, c.size_bytes, c.uploaded_at,
             t.status AS tx_status, t.amount_cents AS tx_amount_cents,
             t.customer_name AS tx_customer_name, t.customer_cpf AS tx_customer_cpf
      FROM comprovantes c
      LEFT JOIN transactions t ON t.id = c.transaction_id
      ORDER BY c.uploaded_at DESC
      LIMIT ${limit}
    `;
    return res.status(200).json({ rows });
  } catch (e) {
    console.error('admin/comprovantes:', e && e.message ? e.message : e);
    return res.status(500).json({ error: 'erro interno' });
  }
}

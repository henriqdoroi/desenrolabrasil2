import { sql, ensureSchema } from '../../lib/db.js';
import { requireAdmin } from '../../lib/auth.js';

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  try {
    await ensureSchema();
    const s = sql();

    const totals = await s`
      SELECT
        COUNT(*)::int AS total_tx,
        COUNT(*) FILTER (WHERE status = 'PAID')::int AS paid_tx,
        COUNT(*) FILTER (WHERE status = 'PENDING')::int AS pending_tx,
        COUNT(*) FILTER (WHERE status = 'EXPIRED')::int AS expired_tx,
        COALESCE(SUM(amount_cents) FILTER (WHERE status = 'PAID'), 0)::bigint AS revenue_cents,
        COALESCE(SUM(net_cents) FILTER (WHERE status = 'PAID'), 0)::bigint AS net_cents
      FROM transactions
    `;

    const today = await s`
      SELECT
        COUNT(*)::int AS today_tx,
        COUNT(*) FILTER (WHERE status = 'PAID')::int AS today_paid,
        COALESCE(SUM(amount_cents) FILTER (WHERE status = 'PAID'), 0)::bigint AS today_revenue_cents
      FROM transactions
      WHERE created_at >= (NOW() AT TIME ZONE 'America/Sao_Paulo')::date AT TIME ZONE 'America/Sao_Paulo'
    `;

    const comps = await s`SELECT COUNT(*)::int AS total_comp FROM comprovantes`;

    const daily = await s`
      SELECT
        to_char(date_trunc('day', created_at AT TIME ZONE 'America/Sao_Paulo'), 'YYYY-MM-DD') AS day,
        COUNT(*)::int AS tx,
        COUNT(*) FILTER (WHERE status = 'PAID')::int AS paid,
        COALESCE(SUM(amount_cents) FILTER (WHERE status = 'PAID'), 0)::bigint AS revenue_cents
      FROM transactions
      WHERE created_at >= NOW() - INTERVAL '14 days'
      GROUP BY 1
      ORDER BY 1 DESC
      LIMIT 14
    `;

    return res.status(200).json({
      totals: totals[0],
      today: today[0],
      comprovantes_total: comps[0].total_comp,
      daily
    });
  } catch (e) {
    console.error('admin/metrics:', e && e.message ? e.message : e);
    return res.status(500).json({ error: 'erro interno' });
  }
}

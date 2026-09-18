import { sql, ensureSchema } from '../lib/db.js';

export default async function handler(req, res) {
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'ID da transacao nao fornecido' });
  }

  try {
    const response = await fetch(`https://bravopay.club/api/v1/transactions/${id}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${process.env.BRAVOPAY_API_KEY}`
      }
    });

    const data = await response.json();

    if (response.ok && data && data.id) {
      try {
        await ensureSchema();
        const s = sql();
        const paidAt = data.status === 'PAID'
          ? (data.paid_at ? new Date(data.paid_at) : new Date())
          : null;
        await s`
          UPDATE transactions SET
            status = ${data.status || 'PENDING'},
            fee_cents = COALESCE(${data.fee_cents ?? null}, fee_cents),
            net_cents = COALESCE(${data.net_cents ?? null}, net_cents),
            paid_at = COALESCE(${paidAt}, paid_at),
            updated_at = NOW()
          WHERE id = ${data.id}
        `;
      } catch (e) {
        console.error('Erro ao atualizar status no DB:', e && e.message ? e.message : e);
      }
    }

    return res.status(response.status).json(data);
  } catch (error) {
    console.error('Erro na Vercel (status-pix):', error);
    return res.status(500).json({ error: 'Erro interno no servidor' });
  }
}

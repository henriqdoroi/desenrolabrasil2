import { sql, ensureSchema } from '../lib/db.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo nao permitido' });
  }

  try {
    const response = await fetch('https://bravopay.club/api/v1/transactions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${process.env.BRAVOPAY_API_KEY}`
      },
      body: JSON.stringify(req.body)
    });

    const data = await response.json();

    if (response.ok && data && data.id) {
      try {
        await ensureSchema();
        const s = sql();
        const body = req.body || {};
        const c = body.customer || {};
        const acordo = body.acordo || null;
        await s`
          INSERT INTO transactions (
            id, external_reference, status, amount_cents,
            customer_name, customer_email, customer_cpf, customer_phone,
            pix_copy_paste, utm, acordo
          ) VALUES (
            ${data.id},
            ${body.external_reference || null},
            ${data.status || 'PENDING'},
            ${data.amount_cents || body.amount_cents || 0},
            ${c.name || null},
            ${c.email || null},
            ${c.cpf || null},
            ${c.phone || null},
            ${data.pix && data.pix.copy_paste ? data.pix.copy_paste : null},
            ${body.utm ? JSON.stringify(body.utm) : null}::jsonb,
            ${acordo}
          )
          ON CONFLICT (id) DO UPDATE SET
            status = EXCLUDED.status,
            pix_copy_paste = COALESCE(EXCLUDED.pix_copy_paste, transactions.pix_copy_paste),
            updated_at = NOW()
        `;
      } catch (e) {
        console.error('Erro ao gravar transacao no DB:', e && e.message ? e.message : e);
      }
    }

    return res.status(response.status).json(data);
  } catch (error) {
    console.error('Erro na Vercel (criar-pix):', error);
    return res.status(500).json({ error: 'Erro interno no servidor' });
  }
}

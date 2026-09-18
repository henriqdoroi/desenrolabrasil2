import { sql, ensureSchema } from '../lib/db.js';

export const config = {
  api: {
    bodyParser: { sizeLimit: '4.5mb' }
  }
};

const MAX_BYTES = 3 * 1024 * 1024;
// Some phones/browsers report JPEG/JFIF files with less common MIME types.
const ALLOWED = /^(image\/(png|jpe?g|pjpeg|jfif|gif|webp|heic|heif)|application\/pdf)$/i;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo nao permitido' });
  }

  try {
    const b = req.body || {};
    if (!b.file_name || !b.mime_type || !b.data_base64) {
      return res.status(400).json({ error: 'campos obrigatorios ausentes' });
    }
    if (!ALLOWED.test(String(b.mime_type))) {
      return res.status(400).json({ error: 'tipo de arquivo nao suportado' });
    }
    const rawBase64 = String(b.data_base64).replace(/^data:[^;]+;base64,/, '').replace(/\s/g, '');
    const buf = Buffer.from(rawBase64, 'base64');
    if (!buf.length) return res.status(400).json({ error: 'arquivo vazio ou base64 invalido' });
    if (buf.length > MAX_BYTES) return res.status(413).json({ error: 'arquivo maior que 3 MB' });

    await ensureSchema();
    const s = sql();
    const rows = await s`
      INSERT INTO comprovantes (
        transaction_id, cpf, nome, acordo,
        file_name, mime_type, data, size_bytes
      ) VALUES (
        ${b.transaction_id || null},
        ${(b.cpf || '').replace(/\D/g, '') || null},
        ${b.nome || null},
        ${b.acordo || null},
        ${String(b.file_name).slice(0, 200)},
        ${String(b.mime_type).slice(0, 80)},
        decode(${rawBase64}, 'base64'),
        ${buf.length}
      )
      RETURNING id, uploaded_at
    `;

    return res.status(200).json({ ok: true, id: rows[0].id, uploaded_at: rows[0].uploaded_at });
  } catch (error) {
    console.error('Erro upload-comprovante:', error && error.message ? error.message : error);
    return res.status(500).json({ error: 'Falha ao salvar o comprovante. Verifique o banco de dados.' });
  }
}

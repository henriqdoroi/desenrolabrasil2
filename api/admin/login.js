import { checkCredentials, issueCookie } from '../../lib/auth.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, private');
  if (req.method !== 'POST') return res.status(405).json({ error: 'metodo nao permitido' });
  const { email, password } = req.body || {};
  if (!checkCredentials(email, password)) {
    return res.status(401).json({ error: 'credenciais invalidas' });
  }
  res.setHeader('Set-Cookie', issueCookie(String(email)));
  return res.status(200).json({ ok: true });
}

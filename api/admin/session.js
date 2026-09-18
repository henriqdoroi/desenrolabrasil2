import { readSession } from '../../lib/auth.js';

export default async function handler(req, res) {
  const s = readSession(req);
  if (!s || s.email !== process.env.ADMIN_EMAIL) {
    return res.status(200).json({ authenticated: false });
  }
  return res.status(200).json({ authenticated: true, email: s.email });
}

import { Request, Router } from 'express';
import { AUTH_COOKIE, authService } from '../services/auth.service';
import { getSessionToken, requireAuth } from '../middleware/auth.middleware';
import { CONFIG } from '../config';

const router = Router();
const isSecureRequest = (req: Request): boolean => {
  if (process.env.COOKIE_SECURE === 'true') return true;
  if (process.env.COOKIE_SECURE === 'false') return false;
  return Boolean(req.secure || req.headers['x-forwarded-proto'] === 'https' || CONFIG.FRONTEND_URL.startsWith('https://'));
};

router.post('/login', async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!email || !password) return res.status(400).json({ error: 'Correo y contraseña son obligatorios.' });
  const result = await authService.login(email, password);
  if (!result) return res.status(401).json({ error: 'Credenciales inválidas.' });
  res.cookie(AUTH_COOKIE, result.token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isSecureRequest(req),
    maxAge: CONFIG.AUTH_SESSION_HOURS * 60 * 60 * 1000,
    path: '/',
  });
  return res.json({ user: result.user });
});

router.get('/me', requireAuth, (req, res) => res.json({ user: req.user }));

router.post('/logout', async (req, res) => {
  await authService.logout(getSessionToken(req));
  res.clearCookie(AUTH_COOKIE, { httpOnly: true, sameSite: 'lax', secure: isSecureRequest(req), path: '/' });
  return res.json({ success: true });
});

export default router;

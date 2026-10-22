import { Request, Response, NextFunction } from 'express';
import { AUTH_COOKIE, AuthUser, UserRole, authService } from '../services/auth.service';

declare global {
  namespace Express {
    interface Request { user?: AuthUser; }
  }
}

function getCookie(req: Request, name: string) {
  const value = req.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return value ? decodeURIComponent(value.slice(name.length + 1)) : undefined;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await authService.validateSession(getCookie(req, AUTH_COOKIE));
    if (!user) return res.status(401).json({ error: 'Autenticación requerida.' });
    req.user = user;
    return next();
  } catch (error) {
    console.error('Error validando sesión:', error);
    return res.status(401).json({ error: 'Sesión inválida.' });
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ error: 'No tienes permisos para esta acción.' });
    return next();
  };
}

export function getSessionToken(req: Request) { return getCookie(req, AUTH_COOKIE); }

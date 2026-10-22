import crypto from 'crypto';
import { CONFIG } from '../config';
import { prisma } from './database.service';

export type UserRole = 'ADMIN' | 'AUXILIAR';
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

const SESSION_COOKIE = 'hun_session';
const fallbackUsers = new Map<string, { user: AuthUser; passwordHash: string }>();
const fallbackSessions = new Map<string, { user: AuthUser; expiresAt: number }>();

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function hashPassword(password: string, salt = crypto.randomBytes(16).toString('hex')) {
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, storedHash: string) {
  const [salt, expected] = storedHash.split(':');
  if (!salt || !expected) return false;
  const actual = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'));
}

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function publicUser(user: { id: string; email: string; name: string; role: string }): AuthUser {
  return { id: user.id, email: user.email, name: user.name, role: user.role as UserRole };
}

class AuthService {
  private dbAvailable = false;
  private initialized = false;

  public async initialize() {
    if (this.initialized) return;
    this.initialized = true;
    try {
      await prisma.$connect();
      this.dbAvailable = true;
      await this.ensureBootstrapUser(CONFIG.AUTH_ADMIN_EMAIL, CONFIG.AUTH_ADMIN_PASSWORD, 'Administrador HUN', 'ADMIN');
      await this.ensureBootstrapUser(CONFIG.AUTH_AUXILIAR_EMAIL, CONFIG.AUTH_AUXILIAR_PASSWORD, 'Auxiliar HUN', 'AUXILIAR');
      console.log('✅ Autenticación conectada a PostgreSQL.');
    } catch {
      this.dbAvailable = false;
      this.seedFallbackUsers();
      console.log('ℹ️ Autenticación en memoria para desarrollo (PostgreSQL no disponible).');
    }
  }

  private seedFallbackUsers() {
    if (fallbackUsers.size > 0) return;
    fallbackUsers.set(normalizeEmail(CONFIG.AUTH_ADMIN_EMAIL), {
      user: { id: 'user-admin', email: normalizeEmail(CONFIG.AUTH_ADMIN_EMAIL), name: 'Administrador HUN', role: 'ADMIN' },
      passwordHash: hashPassword(CONFIG.AUTH_ADMIN_PASSWORD),
    });
    fallbackUsers.set(normalizeEmail(CONFIG.AUTH_AUXILIAR_EMAIL), {
      user: { id: 'user-auxiliar', email: normalizeEmail(CONFIG.AUTH_AUXILIAR_EMAIL), name: 'Auxiliar HUN', role: 'AUXILIAR' },
      passwordHash: hashPassword(CONFIG.AUTH_AUXILIAR_PASSWORD),
    });
  }

  private async ensureBootstrapUser(email: string, password: string, name: string, role: UserRole) {
    const normalized = normalizeEmail(email);
    const existing = await prisma.user.findUnique({ where: { email: normalized } });
    if (!existing) {
      await prisma.user.create({ data: { email: normalized, name, role, passwordHash: hashPassword(password) } });
    }
  }

  public async login(email: string, password: string) {
    await this.initialize();
    const normalized = normalizeEmail(email);
    let user: AuthUser | undefined;
    let valid = false;

    if (this.dbAvailable) {
      const record = await prisma.user.findUnique({ where: { email: normalized } });
      if (record && record.isActive) {
        valid = verifyPassword(password, record.passwordHash);
        user = publicUser(record);
      }
    } else {
      const record = fallbackUsers.get(normalized);
      if (record) {
        valid = verifyPassword(password, record.passwordHash);
        user = record.user;
      }
    }

    if (!valid || !user) return null;
    const token = crypto.randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + CONFIG.AUTH_SESSION_HOURS * 60 * 60 * 1000);
    if (this.dbAvailable) {
      await prisma.session.create({ data: { tokenHash: hashToken(token), userId: user.id, expiresAt } });
    } else {
      fallbackSessions.set(hashToken(token), { user, expiresAt: expiresAt.getTime() });
    }
    return { token, user, expiresAt };
  }

  public async validateSession(token?: string): Promise<AuthUser | null> {
    if (!token) return null;
    await this.initialize();
    const tokenHash = hashToken(token);
    if (this.dbAvailable) {
      const session = await prisma.session.findUnique({ where: { tokenHash }, include: { user: true } });
      if (!session || session.expiresAt <= new Date() || !session.user.isActive) return null;
      return publicUser(session.user);
    }
    const session = fallbackSessions.get(tokenHash);
    if (!session || session.expiresAt <= Date.now()) {
      fallbackSessions.delete(tokenHash);
      return null;
    }
    return session.user;
  }

  public async logout(token?: string) {
    if (!token) return;
    await this.initialize();
    const tokenHash = hashToken(token);
    if (this.dbAvailable) await prisma.session.deleteMany({ where: { tokenHash } });
    fallbackSessions.delete(tokenHash);
  }
}

export const authService = new AuthService();
export const AUTH_COOKIE = SESSION_COOKIE;

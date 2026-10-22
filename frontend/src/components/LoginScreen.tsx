import React, { FormEvent, useState } from 'react';
import { LockKeyhole, LogIn, ShieldCheck, Mail, Eye, EyeOff } from 'lucide-react';
import { AuthUser, login } from '../lib/api';

export const LoginScreen: React.FC<{ onAuthenticated: (user: AuthUser) => void }> = ({ onAuthenticated }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(email, password);
      onAuthenticated(user);
    } catch {
      setError('Correo o contraseña incorrectos.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen w-full flex items-center justify-center p-4 sm:p-6 overflow-hidden select-none">
      {/* 1. Fondo Cinematográfico: Fotografía de la Fachada del Hospital Universitario Nacional */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat scale-105 transition-transform duration-1000"
        style={{ backgroundImage: `url('/hun_photo_2.jpg')` }}
      />

      {/* 2. Capas de Gradiente Atmosférico Azul Profundo */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#051650]/92 via-[#051650]/70 to-[#051650]/80" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,163,224,0.18)_0,rgba(5,22,80,0.5)_50%,rgba(2,6,23,0.85)_100%)] pointer-events-none" />

      {/* Resplandor Cyan de Luz Ambiental */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-[350px] w-[500px] bg-[#00A3E0]/20 rounded-full blur-3xl"
      />

      {/* 3. Tarjeta de Login con Efecto Cristal Desenfocado (Frosted Glass / Glassmorphism) */}
      <section className="relative z-10 w-full max-w-[420px] rounded-[32px] border border-white/20 bg-white/[0.12] hover:bg-white/[0.15] backdrop-blur-2xl p-7 sm:p-9 text-white shadow-[0_25px_60px_rgba(0,0,0,0.55)] ring-1 ring-white/15 transition-all duration-300">
        {/* Línea de Reflejo de Luz Superior */}
        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent" />

        {/* Cabecera: Logotipo Oficial HUN + HUNiX Particulares */}
        <div className="mb-7 flex flex-col items-center text-center">
          <img
            src="/logo_1_white.png"
            alt="Hospital Universitario Nacional de Colombia"
            className="h-14 sm:h-16 w-auto object-contain drop-shadow-[0_4px_12px_rgba(0,163,224,0.4)] transition-all"
          />

          <div className="mt-3 flex items-center justify-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">
              <span className="hunix-pulse">HUNiX</span>
            </h1>
            <span className="rounded-full border border-[#4d9bec]/40 bg-[#4d9bec]/20 px-2.5 py-0.5 text-[8px] font-black uppercase tracking-[.14em] text-cyan-200 backdrop-blur-sm shadow-xs">
              Particulares
            </span>
          </div>
          <p className="mt-1 text-xs text-cyan-100/80 font-medium">
            Portal de Atención al Paciente
          </p>
        </div>

        <div className="mb-5">
          <h2 className="text-lg font-bold text-white tracking-tight">Iniciar sesión</h2>
          <p className="text-xs text-slate-300/85 mt-0.5">
            Ingresa con tus credenciales institucionales HUN.
          </p>
        </div>

        {/* Formulario de Acceso */}
        <form onSubmit={submit} className="space-y-4">
          {/* Campo Correo */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-cyan-200/90 mb-1.5">
              Correo Institucional
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-cyan-200/70 w-4 h-4 pointer-events-none" strokeWidth={1.5} />
              <input
                required
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-2xl border border-white/20 bg-white/10 hover:bg-white/15 focus:bg-white/20 py-3 pl-10 pr-4 text-xs sm:text-sm text-white placeholder:text-slate-300/50 backdrop-blur-md outline-none focus:border-[#00A3E0] focus:ring-2 focus:ring-[#00A3E0]/40 transition-all shadow-inner font-sans"
                placeholder="usuario@hun.local"
              />
            </div>
          </div>

          {/* Campo Contraseña */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-cyan-200/90 mb-1.5">
              Contraseña
            </label>
            <div className="relative">
              <LockKeyhole className="absolute left-3.5 top-1/2 -translate-y-1/2 text-cyan-200/70 w-4 h-4 pointer-events-none" strokeWidth={1.5} />
              <input
                required
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-2xl border border-white/20 bg-white/10 hover:bg-white/15 focus:bg-white/20 py-3 pl-10 pr-10 text-xs sm:text-sm text-white placeholder:text-slate-300/50 backdrop-blur-md outline-none focus:border-[#00A3E0] focus:ring-2 focus:ring-[#00A3E0]/40 transition-all shadow-inner font-sans"
                placeholder="••••••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-cyan-200/70 hover:text-white transition-colors cursor-pointer"
                title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" strokeWidth={1.5} /> : <Eye className="w-4 h-4" strokeWidth={1.5} />}
              </button>
            </div>
          </div>

          {/* Alerta de Error */}
          {error && (
            <div role="alert" className="rounded-xl border border-red-400/40 bg-red-950/70 backdrop-blur-md px-3.5 py-2 text-xs text-red-200 shadow-sm animate-pulse">
              {error}
            </div>
          )}

          {/* Botón de Envío */}
          <div className="pt-2">
            <button
              disabled={loading}
              className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-[#00A3E0] via-[#1d58d8] to-[#155dfc] hover:opacity-95 active:scale-[0.99] text-white font-bold text-xs sm:text-sm uppercase tracking-wider shadow-lg shadow-sky-950/50 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-wait"
            >
              <LogIn className="h-4 w-4" strokeWidth={1.75} />
              <span>{loading ? 'Validando sesión…' : 'Entrar al panel'}</span>
            </button>
          </div>
        </form>

        {/* Pie de Seguridad */}
        <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-center gap-2 text-[11px] text-cyan-100/70">
          <ShieldCheck className="h-4 w-4 text-emerald-400" strokeWidth={1.5} />
          <span>Sesión institucional protegida y cifrada</span>
        </div>
      </section>
    </main>
  );
};

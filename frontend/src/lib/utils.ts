import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Detecta si un string corresponde a un LID interno de WhatsApp
 */
export function isLidPhone(phone?: string | null): boolean {
  if (!phone || typeof phone !== 'string') return false;
  if (phone.includes('@lid')) return true;
  const digits = phone.replace(/\D/g, '');
  if (digits.length > 12) return true;
  if (digits.length >= 11 && !digits.startsWith('57')) return true;
  return false;
}

/**
 * Formatea un número telefónico para visualización en el dashboard
 */
export function formatPhoneDisplay(phone?: string | null): string {
  if (!phone || typeof phone !== 'string') return 'No registrado';
  const digits = phone.replace(/\D/g, '');
  if (isLidPhone(phone)) {
    return 'WhatsApp (ID temporal)';
  }
  if (digits.length === 12 && digits.startsWith('573')) {
    const local = digits.slice(2);
    return `+57 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
  }
  if (digits.length === 10 && digits.startsWith('3')) {
    return `+57 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }
  return phone.startsWith('+') ? phone : `+${phone}`;
}

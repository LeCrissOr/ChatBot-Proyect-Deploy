/**
 * Utilidades para normalización y formateo de números telefónicos (Colombia / E.164).
 */

/**
 * Detecta si un identificador numérico corresponde a un LID interno de WhatsApp
 * (Linked Identity / Multi-Device ID) en lugar de una línea telefónica real.
 * Los LIDs suelen tener más de 12 dígitos y no comienzan con el indicativo 57 de Colombia.
 */
export function isLidPhone(phone: string | null | undefined): boolean {
  if (!phone || typeof phone !== 'string') return false;
  if (phone.includes('@lid')) return true;
  const digits = phone.replace(/\D/g, '');
  if (digits.length > 12) return true;
  if (digits.length >= 11 && !digits.startsWith('57')) return true;
  return false;
}

/**
 * Normaliza números telefónicos en Colombia a formato internacional E.164 (sin signo +).
 * - Celulares colombianos: 10 dígitos iniciando por 3 (ej: 3112345678) -> 573112345678
 * - Líneas fijas con esquema unificado 60X: 10 dígitos iniciando por 60 (ej: 6013905000) -> 576013905000
 * - Números con indicativo internacional 57 (ej: 573112345678) -> 573112345678
 */
export function normalizeColombianPhone(phone: string | null | undefined): string {
  if (!phone || typeof phone !== 'string') return '';
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';

  // 10 dígitos iniciando en 3 (celular Colombia)
  if (digits.length === 10 && digits.startsWith('3')) {
    return `57${digits}`;
  }
  // 10 dígitos iniciando en 60 (fijo Colombia esquema nacional unificado)
  if (digits.length === 10 && digits.startsWith('60')) {
    return `57${digits}`;
  }
  // 12 dígitos iniciando en 57 (ya internacional Colombia)
  if (digits.length === 12 && digits.startsWith('57')) {
    return digits;
  }
  return digits;
}

/**
 * Formatea un número telefónico para mostrarlo amigablemente al paciente en pantallas o fichas.
 * Ej: 573112345678 -> +57 311 234 5678
 */
export function formatPhoneFriendly(phone: string | null | undefined): string {
  if (!phone || typeof phone !== 'string') return '';
  if (isLidPhone(phone)) return 'WhatsApp (ID temporal)';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('573')) {
    const local = digits.slice(2);
    return `+57 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
  }
  if (digits.length === 10 && digits.startsWith('3')) {
    return `+57 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }
  return phone;
}

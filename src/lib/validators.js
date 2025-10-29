/**
 * Validation utilities for common data formats
 */

/**
 * Validates phone number format: +{prefix} {number}
 * Examples:
 *   ✅ "+34 612345678"
 *   ✅ "+1 5551234567"
 *   ✅ "+44 7911123456"
 *   ❌ "612345678" (missing prefix)
 *   ❌ "+34612345678" (missing space)
 *   ❌ "+34 612 345 678" (extra spaces in number)
 *
 * @param {string} phone - Phone number to validate
 * @returns {boolean} True if valid format
 */
export function validatePhoneFormat(phone) {
  if (!phone || typeof phone !== 'string') {
    return false;
  }

  // Regex: + seguido de 1-4 dígitos (prefijo), espacio, y luego 4-15 dígitos (número)
  const phoneRegex = /^\+\d{1,4}\s\d{4,15}$/;

  return phoneRegex.test(phone.trim());
}

/**
 * Normalizes a phone number to the expected format
 * Removes extra spaces, ensures single space after prefix
 *
 * @param {string} phone - Phone number to normalize
 * @returns {string|null} Normalized phone or null if invalid
 */
export function normalizePhone(phone) {
  if (!phone || typeof phone !== 'string') {
    return null;
  }

  // Remove all spaces
  let cleaned = phone.replace(/\s+/g, '');

  // Check if starts with +
  if (!cleaned.startsWith('+')) {
    return null;
  }

  // Extract prefix (1-4 digits after +) and rest
  const match = cleaned.match(/^\+(\d{1,4})(\d{4,15})$/);

  if (!match) {
    return null;
  }

  const [, prefix, number] = match;

  // Return formatted: +prefix number
  return `+${prefix} ${number}`;
}

/**
 * Validates and normalizes phone number
 * Use this in endpoints to both validate and clean user input
 *
 * @param {string} phone - Phone number to validate and normalize
 * @returns {{ valid: boolean, normalized: string|null, error?: string }}
 */
export function validateAndNormalizePhone(phone) {
  if (!phone) {
    return { valid: true, normalized: null }; // nullable field
  }

  const normalized = normalizePhone(phone);

  if (!normalized) {
    return {
      valid: false,
      normalized: null,
      error: 'Formato de teléfono inválido. Debe ser: +{prefijo} {número}. Ejemplo: +34 612345678',
    };
  }

  return { valid: true, normalized };
}

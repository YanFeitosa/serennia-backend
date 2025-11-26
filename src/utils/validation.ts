// Utility functions for input validation and sanitization

export function sanitizeString(input: string | undefined | null | number | boolean): string {
  if (input === null || input === undefined) {
    return '';
  }
  
  // Convert to string if not already
  if (typeof input !== 'string') {
    input = String(input);
  }
  
  return input.trim();
}

export function validateEmail(email: string | undefined | null | number | boolean): boolean {
  if (!email) return false;
  
  // Convert to string if not already
  if (typeof email !== 'string') {
    email = String(email);
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

export function validatePhone(phone: string | undefined | null | number | boolean): boolean {
  if (!phone) return false;
  
  // Convert to string if not already
  if (typeof phone !== 'string') {
    phone = String(phone);
  }
  
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');
  // Brazilian phone: 10-11 digits (with or without country code)
  return cleaned.length >= 10 && cleaned.length <= 13;
}

export function sanitizePhone(phone: string | undefined | null | number | boolean): string {
  if (!phone) return '';
  
  // Convert to string if not already
  if (typeof phone !== 'string') {
    phone = String(phone);
  }
  
  return phone.replace(/\D/g, '');
}

export function validateUuid(uuid: string | undefined | null): boolean {
  if (!uuid) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

export function sanitizeHtml(input: string | undefined | null): string {
  if (!input) return '';
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}


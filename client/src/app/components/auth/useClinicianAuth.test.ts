import { describe, expect, it } from 'vitest';
import { normalizeTotpQrCode } from './useClinicianAuth';

describe('normalizeTotpQrCode', () => {
  it('wraps raw SVG QR markup as an encoded data URL', () => {
    const normalized = normalizeTotpQrCode('<svg><path fill="#000" /></svg>');

    expect(normalized).toBe('data:image/svg+xml;utf8,%3Csvg%3E%3Cpath%20fill%3D%22%23000%22%20%2F%3E%3C%2Fsvg%3E');
  });

  it('encodes raw SVG payloads inside Supabase data URLs', () => {
    const normalized = normalizeTotpQrCode('data:image/svg+xml;utf-8,<svg><path fill="#000" /></svg>');

    expect(normalized).toBe('data:image/svg+xml;utf-8,%3Csvg%3E%3Cpath%20fill%3D%22%23000%22%20%2F%3E%3C%2Fsvg%3E');
  });

  it('keeps already encoded QR data URLs unchanged', () => {
    const encoded = 'data:image/svg+xml;utf-8,%3Csvg%3E%3C%2Fsvg%3E';

    expect(normalizeTotpQrCode(encoded)).toBe(encoded);
  });
});

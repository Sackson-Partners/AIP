import { safeRedirect } from '../safeRedirect';

describe('safeRedirect', () => {
  it('returns a safe local path unchanged', () => {
    expect(safeRedirect('/dashboard')).toBe('/dashboard');
  });

  it('blocks external absolute URLs', () => {
    expect(safeRedirect('https://evil.com')).toBe('/dashboard');
  });

  it('blocks protocol-relative URLs', () => {
    expect(safeRedirect('//evil.com')).toBe('/dashboard');
  });

  it('returns the fallback for null', () => {
    expect(safeRedirect(null)).toBe('/dashboard');
  });

  it('returns the fallback for undefined', () => {
    expect(safeRedirect(undefined)).toBe('/dashboard');
  });

  it('returns the fallback for an empty string', () => {
    expect(safeRedirect('')).toBe('/dashboard');
  });

  it('preserves query string on a safe path', () => {
    expect(safeRedirect('/dashboard?tab=overview')).toBe('/dashboard?tab=overview');
  });

  it('uses a custom fallback when provided', () => {
    expect(safeRedirect('https://evil.com', '/home')).toBe('/home');
  });

  it('uses the custom fallback for null', () => {
    expect(safeRedirect(null, '/home')).toBe('/home');
  });

  it('blocks javascript: scheme', () => {
    expect(safeRedirect('javascript:alert(1)')).toBe('/dashboard');
  });

  it('preserves deep paths', () => {
    expect(safeRedirect('/dashboard/projects/123')).toBe('/dashboard/projects/123');
  });
});

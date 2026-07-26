import { getInitials, getColorForName } from '../subscriptionIcon';

describe('getInitials', () => {
  test('single word returns first two letters, uppercased', () => {
    expect(getInitials('Netflix')).toBe('NE');
  });

  test('multiple words returns first letter of each of the first two words', () => {
    expect(getInitials('Amazon Prime')).toBe('AP');
    expect(getInitials('Disney Plus Bundle')).toBe('DP');
  });

  test('handles extra whitespace', () => {
    expect(getInitials('  Netflix  ')).toBe('NE');
    expect(getInitials('Amazon   Prime')).toBe('AP');
  });

  test('single-character name does not crash', () => {
    expect(getInitials('X')).toBe('X');
  });

  test('empty string returns a fallback rather than crashing', () => {
    expect(getInitials('')).toBe('?');
    expect(getInitials('   ')).toBe('?');
  });
});

describe('getColorForName', () => {
  test('is deterministic: same name always returns the same color', () => {
    const c1 = getColorForName('Netflix');
    const c2 = getColorForName('Netflix');
    expect(c1).toBe(c2);
  });

  test('is case-insensitive and whitespace-insensitive', () => {
    expect(getColorForName('Netflix')).toBe(getColorForName('NETFLIX'));
    expect(getColorForName('Netflix')).toBe(getColorForName('  netflix  '));
  });

  test('returns a valid hex color string', () => {
    expect(getColorForName('Spotify')).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  test('different names commonly produce different colors', () => {
    // Not a strict guarantee (hash collisions across a small palette are
    // expected sometimes), but a handful of distinct names should not all
    // collide onto the exact same color.
    const names = ['Netflix', 'Spotify', 'Hulu', 'Disney+', 'HBO Max', 'YouTube Premium'];
    const colors = new Set(names.map(getColorForName));
    expect(colors.size).toBeGreaterThan(1);
  });
});

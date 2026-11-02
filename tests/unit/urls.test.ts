import { expect, test } from 'vitest';
import { unwrapGoogleRedirect } from '../../src/data/urls';

test('unwraps Gmail google.com/url redirect', () => {
  expect(unwrapGoogleRedirect('https://www.google.com/url?q=https://finance.yahoo.com/a.html&source=gmail&ust=1&sa=E')).toBe('https://finance.yahoo.com/a.html');
});

test('decodes percent-encoded target', () => {
  expect(unwrapGoogleRedirect('https://www.google.com/url?q=https%3A%2F%2Fx.com%2Fa%3Fb%3D1&sa=E')).toBe('https://x.com/a?b=1');
});

test('leaves normal urls untouched', () => {
  expect(unwrapGoogleRedirect('https://www.cnbc.com/2026/10/28/x.html')).toBe('https://www.cnbc.com/2026/10/28/x.html');
});

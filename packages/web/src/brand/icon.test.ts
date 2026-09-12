import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ICON_SVG } from './icon.svg.js';

describe('public/icon.svg', () => {
  it('matches the mark the brand module draws', () => {
    const onDisk = readFileSync(new URL('../../public/icon.svg', import.meta.url), 'utf8');
    // A favicon has to be a static file, so the geometry lives in two places.
    // Regenerate public/icon.svg from ICON_SVG when this fails.
    expect(onDisk).toBe(ICON_SVG);
  });
});

/**
 * docs/MADFU_PROPOSED_JOURNEY.md is generated from the model by `npm run docs`. This test fails when the
 * committed file no longer matches the model (the document cannot drift from the prototype).
 */
import { describe, expect, it } from 'vitest';
import committed from '../../../docs/MADFU_PROPOSED_JOURNEY.md?raw';
import { renderJourneyDoc } from './model/docs';

describe('generated product-rule document', () => {
  it('matches the model (run npm run docs after changing the model)', () => {
    expect(committed).toBe(renderJourneyDoc());
  });
});

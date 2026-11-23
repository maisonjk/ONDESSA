import { describe, expect, it } from 'vitest';
import { shapeModelOutput, libraryAnswer, costUsd, cleanInput, SYSTEM_PROMPT, CRISIS_RESULT, type ModelOutput } from './companion-core.js';
import { VERSES } from '../../src/content/scripture.js';

const base: ModelOutput = {
  needs_follow_up: false, follow_up_question: '', lie: 'I have to earn love.', root: 'Pressure growing up.',
  verse_ids: ['rom-5-8'], explanation: 'Context…', truth: 'I am loved first.', action: 'Rest today.', crisis: false,
};

describe('anti-fabrication', () => {
  it('renders verse text from the database, never from the model', () => {
    const out = shapeModelOutput(base)!;
    expect(out.verses[0].text).toBe(VERSES.find((v) => v.id === 'rom-5-8')!.text);
    expect(out.source).toBe('ai');
  });
  it('drops unknown verse ids and rejects output with none left', () => {
    expect(shapeModelOutput({ ...base, verse_ids: ['made-up-3-16', 'rom-5-8'] })!.verses.map((v) => v.id)).toEqual(['rom-5-8']);
    expect(shapeModelOutput({ ...base, verse_ids: ['John 3:16'] })).toBeNull();
  });
  it('caps at two verses and dedupes', () => {
    expect(shapeModelOutput({ ...base, verse_ids: ['rom-5-8', 'rom-5-8', 'ps-139-14', 'eph-2-10'] })!.verses).toHaveLength(2);
  });
  it('routes model-flagged crisis to resources', () => {
    expect(shapeModelOutput({ ...base, crisis: true })).toBe(CRISIS_RESULT);
  });
  it('marks follow-ups', () => {
    expect(shapeModelOutput({ ...base, needs_follow_up: true, follow_up_question: 'What happened?' })!.kind).toBe('followup');
  });
  it('lists every catalog id in the system prompt', () => {
    for (const v of VERSES) expect(SYSTEM_PROMPT).toContain(`${v.id} | ${v.ref}`);
  });
});

describe('library fallback and cost', () => {
  it('answers without AI', () => {
    const a = libraryAnswer('I am not good enough');
    expect(a.source).toBe('library');
    expect(a.verses.length).toBeGreaterThan(0);
  });
  it('short-circuits crisis', () => {
    expect(libraryAnswer('I want to kill myself').kind).toBe('crisis');
  });
  it('computes cost including cache reads', () => {
    expect(costUsd('claude-opus-5-5', { input_tokens: 1_000_000, output_tokens: 0 })).toBe(4);
    expect(costUsd('claude-haiku-5-5', { input_tokens: 0, output_tokens: 1_000_000 })).toBe(0.5);
    expect(costUsd('claude-opus-5-5', { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 1_000_000 })).toBeCloseTo(0.4);
  });
  it('cleans and caps input', () => {
    expect(cleanInput('  a\n\n b ')).toBe('a b');
    expect(cleanInput('x'.repeat(2000))).toHaveLength(800);
    expect(cleanInput(42)).toBe('');
  });
});

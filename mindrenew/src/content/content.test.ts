import { describe, expect, it } from 'vitest';
import { VERSES, VERSE_BY_ID } from './scripture';
import { CATEGORIES, LIES, liesForCategory } from './lies';
import { DAILY_TRUTHS, WEEKLY_THEMES } from './daily';
import { JOURNEYS } from './journeys';

describe('scripture database', () => {
  it('has unique ids and well-formed references', () => {
    expect(new Set(VERSES.map((v) => v.id)).size).toBe(VERSES.length);
    for (const v of VERSES) {
      expect(v.ref).toMatch(/^(\d )?[A-Z][a-z]+ \d+:\d+(-\d+)?$/);
      expect(v.text.length).toBeGreaterThan(20);
      expect(v.context.length).toBeGreaterThan(40);
      expect(v.tags.length).toBeGreaterThan(0);
    }
  });
});

describe('lie database', () => {
  it('every lie points at real verses', () => {
    for (const l of LIES) {
      expect(VERSE_BY_ID[l.verseId], l.id).toBeTruthy();
      for (const id of l.alsoVerseIds) expect(VERSE_BY_ID[id], `${l.id} -> ${id}`).toBeTruthy();
      expect(l.alsoVerseIds).not.toContain(l.verseId);
      expect(l.keywords.length).toBeGreaterThan(2);
    }
  });
  it('has unique ids', () => {
    expect(new Set(LIES.map((l) => l.id)).size).toBe(LIES.length);
  });
  it('every selectable category offers at least 3 lies', () => {
    for (const c of CATEGORIES.filter((c) => c.id !== 'other')) expect(liesForCategory(c.id).length, c.id).toBeGreaterThanOrEqual(3);
  });
  it('app-written reframes never pose as quotations of Scripture', () => {
    for (const l of LIES) expect(l.reframe).not.toMatch(/^“/);
  });
});

describe('daily content and journeys', () => {
  it('daily truths and journeys reference real content', () => {
    for (const d of DAILY_TRUTHS) expect(VERSE_BY_ID[d.verseId], d.id).toBeTruthy();
    expect(WEEKLY_THEMES.length).toBeGreaterThan(3);
    const lieIds = new Set(LIES.map((l) => l.id));
    for (const j of JOURNEYS) {
      expect(j.days).toHaveLength(7);
      for (const d of j.days) expect(lieIds.has(d.lieId), `${j.id}: ${d.lieId}`).toBe(true);
    }
  });
});

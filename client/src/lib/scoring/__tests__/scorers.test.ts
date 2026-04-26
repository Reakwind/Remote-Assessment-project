import { describe, it, expect } from 'vitest';
import {
  scoreOrientation,
  scoreDigitSpan,
  scoreVigilance,
  scoreSerial7s,
  scoreLanguage,
  scoreAbstraction,
  scoreDelayedRecall,
  scoreNaming,
  scoreDrawing,
} from '../scorers';

const SESSION_DATE = new Date('2026-04-21');
const SESSION_LOCATION = { place: 'מרפאה', city: 'תל אביב' };

describe('scoreOrientation', () => {
  it('scores all 6 fields correct', () => {
    const items = scoreOrientation(
      { date: '21', month: 'אפריל', year: '2026', day: 'שלישי', place: 'מרפאה', city: 'תל אביב' },
      SESSION_DATE, SESSION_LOCATION
    );
    expect(items).toHaveLength(6);
    expect(items.every(i => i.score === 1)).toBe(true);
  });

  it('scores wrong date as 0', () => {
    const items = scoreOrientation(
      { date: '22', month: 'אפריל', year: '2026', day: 'שלישי', place: 'מרפאה', city: 'תל אביב' },
      SESSION_DATE, SESSION_LOCATION
    );
    const dateItem = items.find(i => i.taskId === 'orientation.date');
    expect(dateItem?.score).toBe(0);
  });

  it('scores wrong month/year/day/place/city as 0', () => {
    const items = scoreOrientation(
      { date: '21', month: 'מאי', year: '2025', day: 'רביעי', place: 'בית', city: 'חיפה' },
      SESSION_DATE, SESSION_LOCATION
    );
    expect(items.find(i => i.taskId === 'orientation.month')?.score).toBe(0);
    expect(items.find(i => i.taskId === 'orientation.year')?.score).toBe(0);
    expect(items.find(i => i.taskId === 'orientation.day')?.score).toBe(0);
    expect(items.find(i => i.taskId === 'orientation.place')?.score).toBe(0);
    expect(items.find(i => i.taskId === 'orientation.city')?.score).toBe(0);
  });

  it('trims whitespace before comparing', () => {
    const items = scoreOrientation(
      { date: ' 21 ', month: 'אפריל', year: '2026', day: 'שלישי', place: 'מרפאה', city: 'תל אביב' },
      SESSION_DATE, SESSION_LOCATION
    );
    const dateItem = items.find(i => i.taskId === 'orientation.date');
    expect(dateItem?.score).toBe(1);
  });

  it('total max is 6', () => {
    const items = scoreOrientation(
      { date: '21', month: 'אפריל', year: '2026', day: 'שלישי', place: 'מרפאה', city: 'תל אביב' },
      SESSION_DATE, SESSION_LOCATION
    );
    expect(items.reduce((s, i) => s + i.max, 0)).toBe(6);
  });

  it('scores wrong month/day/place/city as 0', () => {
    const items = scoreOrientation(
      { date: '21', month: 'מאי', year: '2026', day: 'שני', place: 'בית', city: 'חיפה' },
      SESSION_DATE, SESSION_LOCATION
    );
    expect(items.find(i => i.taskId === 'orientation.month')?.score).toBe(0);
    expect(items.find(i => i.taskId === 'orientation.day')?.score).toBe(0);
    expect(items.find(i => i.taskId === 'orientation.place')?.score).toBe(0);
    expect(items.find(i => i.taskId === 'orientation.city')?.score).toBe(0);
  });
});

describe('scoreDigitSpan', () => {
  it('scores both correct', () => {
    const items = scoreDigitSpan({ forward: { isCorrect: true }, backward: { isCorrect: true } });
    expect(items.find(i => i.taskId === 'digit-span.forward')?.score).toBe(1);
    expect(items.find(i => i.taskId === 'digit-span.backward')?.score).toBe(1);
  });

  it('scores both wrong', () => {
    const items = scoreDigitSpan({ forward: { isCorrect: false }, backward: { isCorrect: false } });
    expect(items.every(i => i.score === 0)).toBe(true);
  });

  it('total max is 2', () => {
    const items = scoreDigitSpan({ forward: { isCorrect: true }, backward: { isCorrect: false } });
    expect(items.reduce((s, i) => s + i.max, 0)).toBe(2);
  });
});

describe('scoreVigilance', () => {
  it('passes through score=1', () => {
    const items = scoreVigilance({ score: 1 });
    expect(items[0].score).toBe(1);
  });

  it('passes through score=0', () => {
    const items = scoreVigilance({ score: 0 });
    expect(items[0].score).toBe(0);
  });

  it('max is 1', () => {
    expect(scoreVigilance({ score: 1 })[0].max).toBe(1);
  });

  it('clamps score to item bounds', () => {
    expect(scoreVigilance({ score: 3 })[0].score).toBe(1);
    expect(scoreVigilance({ score: -2 })[0].score).toBe(0);
  });
});

describe('scoreSerial7s', () => {
  it('4 correct → 3 points', () => {
    const data = [
      { isCorrect: true }, { isCorrect: true }, { isCorrect: true },
      { isCorrect: true }, { isCorrect: false }
    ];
    expect(scoreSerial7s(data)[0].score).toBe(3);
  });

  it('5 correct → 3 points', () => {
    const data = Array(5).fill({ isCorrect: true });
    expect(scoreSerial7s(data)[0].score).toBe(3);
  });

  it('3 correct → 2 points', () => {
    const data = [
      { isCorrect: true }, { isCorrect: true }, { isCorrect: true },
      { isCorrect: false }, { isCorrect: false }
    ];
    expect(scoreSerial7s(data)[0].score).toBe(2);
  });

  it('2 correct → 2 points', () => {
    const data = [
      { isCorrect: true }, { isCorrect: true }, { isCorrect: false },
      { isCorrect: false }, { isCorrect: false }
    ];
    expect(scoreSerial7s(data)[0].score).toBe(2);
  });

  it('1 correct → 1 point', () => {
    const data = [
      { isCorrect: true }, { isCorrect: false }, { isCorrect: false },
      { isCorrect: false }, { isCorrect: false }
    ];
    expect(scoreSerial7s(data)[0].score).toBe(1);
  });

  it('0 correct → 0 points', () => {
    const data = Array(5).fill({ isCorrect: false });
    expect(scoreSerial7s(data)[0].score).toBe(0);
  });

  it('max is 3', () => {
    expect(scoreSerial7s(Array(5).fill({ isCorrect: true }))[0].max).toBe(3);
  });
});

describe('scoreLanguage', () => {
  it('rep1+rep2+fluency≥11 → 3 points', () => {
    const items = scoreLanguage({ rep1: true, rep2: true, fluencyCount: 12 });
    expect(items.reduce((s, i) => s + i.score, 0)).toBe(3);
  });

  it('fluency=11 scores 1 point', () => {
    const items = scoreLanguage({ rep1: false, rep2: false, fluencyCount: 11 });
    const fluency = items.find(i => i.taskId === 'language.fluency');
    expect(fluency?.score).toBe(1);
  });

  it('fluency=10 scores 0 points', () => {
    const items = scoreLanguage({ rep1: false, rep2: false, fluencyCount: 10 });
    const fluency = items.find(i => i.taskId === 'language.fluency');
    expect(fluency?.score).toBe(0);
  });

  it('total max is 3', () => {
    const items = scoreLanguage({ rep1: true, rep2: true, fluencyCount: 15 });
    expect(items.reduce((s, i) => s + i.max, 0)).toBe(3);
  });
});

describe('scoreAbstraction', () => {
  it('both correct → 2 points', () => {
    const items = scoreAbstraction({ pair1: true, pair2: true });
    expect(items.reduce((s, i) => s + i.score, 0)).toBe(2);
  });

  it('one wrong → 1 point', () => {
    const items = scoreAbstraction({ pair1: true, pair2: false });
    expect(items.reduce((s, i) => s + i.score, 0)).toBe(1);
  });

  it('total max is 2', () => {
    const items = scoreAbstraction({ pair1: false, pair2: false });
    expect(items.reduce((s, i) => s + i.max, 0)).toBe(2);
  });
});

describe('scoreDelayedRecall', () => {
  const TARGET_WORDS = ['פנס', 'חסידה', 'ורד', 'ירח', 'אמת'];

  it('all 5 recalled → 5 points', () => {
    const items = scoreDelayedRecall({ recalled: TARGET_WORDS }, TARGET_WORDS);
    expect(items.reduce((s, i) => s + i.score, 0)).toBe(5);
  });

  it('3 recalled → 3 points', () => {
    const items = scoreDelayedRecall({ recalled: ['פנס', 'חסידה', 'ורד'] }, TARGET_WORDS);
    expect(items.reduce((s, i) => s + i.score, 0)).toBe(3);
  });

  it('none recalled → 0 points', () => {
    const items = scoreDelayedRecall({ recalled: [] }, TARGET_WORDS);
    expect(items.reduce((s, i) => s + i.score, 0)).toBe(0);
  });

  it('total max is 5', () => {
    const items = scoreDelayedRecall({ recalled: [] }, TARGET_WORDS);
    expect(items.reduce((s, i) => s + i.max, 0)).toBe(5);
  });

  it('non-target words do not score', () => {
    const items = scoreDelayedRecall({ recalled: ['כלב', 'חתול'] }, TARGET_WORDS);
    expect(items.reduce((s, i) => s + i.score, 0)).toBe(0);
  });
});

describe('scoreNaming', () => {
  const CORRECT = ['אריה', 'קרנף', 'גמל'];

  it('all 3 correct → 3 points', () => {
    const items = scoreNaming(['אריה', 'קרנף', 'גמל'], CORRECT);
    expect(items.reduce((s, i) => s + i.score, 0)).toBe(3);
  });

  it('one wrong → 2 points', () => {
    const items = scoreNaming(['כלב', 'קרנף', 'גמל'], CORRECT);
    expect(items.reduce((s, i) => s + i.score, 0)).toBe(2);
  });

  it('null answer scores 0', () => {
    const items = scoreNaming([null, 'קרנף', 'גמל'], CORRECT);
    expect(items[0].score).toBe(0);
  });

  it('total max is 3', () => {
    const items = scoreNaming([null, null, null], CORRECT);
    expect(items.reduce((s, i) => s + i.max, 0)).toBe(3);
  });
});

describe('scoreDrawing', () => {
  it('marks cube as needsReview with reviewReason drawing', () => {
    const items = scoreDrawing('moca-cube', 1);
    expect(items[0].needsReview).toBe(true);
    expect(items[0].reviewReason).toBe('drawing');
    expect(items[0].score).toBe(0);
    expect(items[0].max).toBe(1);
  });

  it('marks clock as needsReview with max 3', () => {
    const items = scoreDrawing('moca-clock', 3);
    expect(items[0].max).toBe(3);
    expect(items[0].needsReview).toBe(true);
  });
});

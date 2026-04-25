import type { ItemScore } from '../../types/scoring';
import { normalizeHebrew } from './utils';

const HE_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
const HE_DAYS   = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];

function item(taskId: string, score: number, max: number): ItemScore {
  return { taskId, score, max, needsReview: false };
}

function reviewItem(taskId: string, max: number, rawData?: unknown): ItemScore {
  return { taskId, score: 0, max, needsReview: true, reviewReason: 'rule_score_unavailable', rawData };
}

function matches(userInput: string, expected: string): boolean {
  return normalizeHebrew(userInput) === normalizeHebrew(expected);
}

export function scoreOrientation(
  data: { date: string; month: string; year: string; day: string; place: string; city: string },
  sessionDate: Date,
  location?: { place?: string | null; city?: string | null }
): ItemScore[] {
  const expectedPlace = location?.place?.trim();
  const expectedCity = location?.city?.trim();
  return [
    item('orientation.date',  matches(data.date,  String(sessionDate.getDate()))                 ? 1 : 0, 1),
    item('orientation.month', matches(data.month, HE_MONTHS[sessionDate.getMonth()])             ? 1 : 0, 1),
    item('orientation.year',  matches(data.year,  String(sessionDate.getFullYear()))             ? 1 : 0, 1),
    item('orientation.day',   matches(data.day,   HE_DAYS[sessionDate.getDay()])                 ? 1 : 0, 1),
    expectedPlace ? item('orientation.place', matches(data.place, expectedPlace) ? 1 : 0, 1) : reviewItem('orientation.place', 1, data.place),
    expectedCity ? item('orientation.city', matches(data.city, expectedCity) ? 1 : 0, 1) : reviewItem('orientation.city', 1, data.city),
  ];
}

export function scoreDigitSpan(data: { forward: { isCorrect: boolean }; backward: { isCorrect: boolean } }): ItemScore[] {
  return [
    item('digit-span.forward',  data.forward.isCorrect  ? 1 : 0, 1),
    item('digit-span.backward', data.backward.isCorrect ? 1 : 0, 1),
  ];
}

export function scoreVigilance(data: { score: number }): ItemScore[] {
  return [item('moca-vigilance', data.score, 1)];
}

export function scoreSerial7s(data: { isCorrect: boolean }[]): ItemScore[] {
  const correct = data.filter(s => s.isCorrect).length;
  const score = correct >= 4 ? 3 : correct >= 2 ? 2 : correct >= 1 ? 1 : 0;
  return [item('moca-serial-7s', score, 3)];
}

export function scoreLanguage(data: { rep1: boolean; rep2: boolean; fluencyCount: number }, fluencyThreshold = 11): ItemScore[] {
  return [
    item('language.rep1',    data.rep1 ? 1 : 0, 1),
    item('language.rep2',    data.rep2 ? 1 : 0, 1),
    item('language.fluency', data.fluencyCount >= fluencyThreshold ? 1 : 0, 1),
  ];
}

export function scoreAbstraction(data: { pair1: boolean; pair2: boolean }): ItemScore[] {
  return [
    item('abstraction.pair1', data.pair1 ? 1 : 0, 1),
    item('abstraction.pair2', data.pair2 ? 1 : 0, 1),
  ];
}

export function scoreDelayedRecall(data: { recalled: string[] }, targetWords: string[]): ItemScore[] {
  return targetWords.map((word, i) => {
    const recalled = data.recalled.map(normalizeHebrew).includes(normalizeHebrew(word));
    return item(`recall.word${i + 1}`, recalled ? 1 : 0, 1);
  });
}

export function scoreNaming(answers: (string | null)[], correctNames: string[]): ItemScore[] {
  return correctNames.map((correct, i) => {
    const answer = answers[i];
    const isCorrect = answer != null && normalizeHebrew(answer) === normalizeHebrew(correct);
    return item(`naming.item${i + 1}`, isCorrect ? 1 : 0, 1);
  });
}

export function scoreDrawing(taskId: string, max: number): ItemScore[] {
  return [{ taskId, score: 0, max, needsReview: true, reviewReason: 'drawing' }];
}

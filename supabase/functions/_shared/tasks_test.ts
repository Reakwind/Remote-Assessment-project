import { validateTaskPayload } from './tasks.ts';

function assertEquals(actual: unknown, expected: unknown) {
  if (actual !== expected) throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

Deno.test('validateTaskPayload accepts persisted naming answers object from client', () => {
  assertEquals(validateTaskPayload('moca-naming', { answers: { 'item-1': 'סוס', 'item-2': 'נמר', 'item-3': 'ברווז' } }), null);
});

Deno.test('validateTaskPayload accepts legacy naming answers object', () => {
  assertEquals(validateTaskPayload('moca-naming', { answers: { lion: 'אריה', rhino: 'קרנף', camel: 'גמל' } }), null);
});

Deno.test('validateTaskPayload rejects incomplete persisted naming answers object', () => {
  assertEquals(
    validateTaskPayload('moca-naming', { answers: { lion: 'אריה', rhino: 'קרנף' } }),
    'Naming rawData must be an array of 3 answers or an answers object',
  );
});

Deno.test('validateTaskPayload rejects non-string naming answer values', () => {
  assertEquals(
    validateTaskPayload('moca-naming', { answers: { lion: 'אריה', rhino: null, camel: 'גמל' } }),
    'Naming rawData must be an array of 3 answers or an answers object',
  );
});

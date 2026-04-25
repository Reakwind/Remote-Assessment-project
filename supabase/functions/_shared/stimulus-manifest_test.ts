import { assertEquals, assertThrows } from 'https://deno.land/std@0.198.0/testing/asserts.ts';
import { buildStimulusManifest, supportedMocaVersions } from './stimulus-manifest.ts';

Deno.test('buildStimulusManifest creates version-scoped private storage paths', () => {
  const manifest = buildStimulusManifest('8.3');

  assertEquals(manifest.length, 6);
  assertEquals(
    manifest.map((entry) => entry.storagePath),
    [
      '8.3/moca-visuospatial/trail-template.png',
      '8.3/moca-cube/cube-stimulus.png',
      '8.3/moca-naming/item-1.png',
      '8.3/moca-naming/item-2.png',
      '8.3/moca-naming/item-3.png',
      '8.3/moca-memory-learning/word-list-audio.mp3',
    ],
  );
});

Deno.test('buildStimulusManifest supports all configured Hebrew MoCA versions', () => {
  for (const version of supportedMocaVersions()) {
    const manifest = buildStimulusManifest(version);
    assertEquals(manifest.every((entry) => entry.storagePath.startsWith(`${version}/`)), true);
  }
});

Deno.test('buildStimulusManifest rejects unsupported versions', () => {
  assertThrows(
    () => buildStimulusManifest('9.0'),
    Error,
    'Unsupported MoCA version',
  );
});

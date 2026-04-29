#!/usr/bin/env node

export const EDGE_FUNCTIONS = [
  'complete-session',
  'create-session',
  'start-session',
  'get-stimuli',
  'submit-results',
  'save-drawing',
  'save-audio',
  'get-session',
  'update-drawing-review',
  'update-scoring-review',
  'export-pdf',
  'export-csv',
];

export const EDGE_FUNCTION_ENTRYPOINTS = EDGE_FUNCTIONS.map(
  (name) => `supabase/functions/${name}/index.ts`,
);

const COMMANDS = new Set([
  'list',
  'deno-check-args',
  'serve-args',
  'serve-command',
  'deploy-commands',
]);

if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2] ?? 'list';

  if (!COMMANDS.has(command)) {
    console.error(`Unknown command "${command}". Use one of: ${Array.from(COMMANDS).join(', ')}`);
    process.exit(1);
  }

  if (command === 'list') {
    console.log(EDGE_FUNCTIONS.join('\n'));
  }

  if (command === 'deno-check-args') {
    console.log(EDGE_FUNCTION_ENTRYPOINTS.join(' '));
  }

  if (command === 'serve-args') {
    console.log(EDGE_FUNCTIONS.join(' '));
  }

  if (command === 'serve-command') {
    console.log(`supabase functions serve ${EDGE_FUNCTIONS.join(' ')} --env-file /dev/null`);
  }

  if (command === 'deploy-commands') {
    console.log(EDGE_FUNCTIONS.map((name) => `supabase functions deploy ${name}`).join('\n'));
  }
}

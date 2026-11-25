import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const file = new URL('../src/main.tsx', import.meta.url);
const source = ts.createSourceFile(
  file.pathname,
  await readFile(file, 'utf8'),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
const imports = source.statements
  .filter(ts.isImportDeclaration)
  .map((statement) => statement.moduleSpecifier.text);
assert.deepEqual(
  imports.filter((name) => name.endsWith('.css')),
  ['./app.css'],
  'Declare global CSS layers in app.css, not independent sortable imports.',
);
assert.equal(
  imports.at(-1),
  './app.css',
  'Load the approved global cascade after feature-module styles.',
);
console.log('Global style entry follows feature styles; CSS layer order is protected.');

/** Syntax-check the Android Java sources (no JDK required in this sandbox). */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const mod = require('java-parser');
const parse = mod.parse ?? mod.default?.parse ?? mod;
const rootDir = path.join(process.cwd(), 'apps', 'android', 'app', 'src', 'main', 'java');
const files = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir)) {
    const p = path.join(dir, entry);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.java')) files.push(p);
  }
})(rootDir);

let failed = 0;
for (const file of files) {
  try { parse(fs.readFileSync(file, 'utf8')); console.log('OK   ', path.relative(process.cwd(), file)); }
  catch (e) { failed++; console.error('FAIL ', path.relative(process.cwd(), file), String(e.message).slice(0, 300)); }
}
console.log(`${files.length - failed}/${files.length} Java sources parsed cleanly`);
process.exit(failed ? 1 : 0);

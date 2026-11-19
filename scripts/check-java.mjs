/**
 * Syntax-check the Android Java sources (no JDK required in this sandbox).
 *
 * Also rejects lambdas and method references. scripts/build-apk.sh compiles with
 * `javac -source 8 -target 8` against a bare android.jar bootclasspath, which has
 * no java.lang.invoke.LambdaMetafactory, so `() -> {}` fails with
 * "Unable to find method metafactory". That broke the v3.0.0 release build
 * (run 44554774427), so it must never come back.
 */
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
const LAMBDA = [
  /(^|[^-\w])\([^()]*\)\s*->/,
  /(^|[^-\w])[A-Za-z_$][\w$]*\s*->\s*[A-Za-z_{]/,
  /::\s*[A-Za-z_$]/,
];
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  try { parse(source); console.log('OK   ', path.relative(process.cwd(), file)); }
  catch (e) { failed++; console.error('FAIL ', path.relative(process.cwd(), file), String(e.message).slice(0, 300)); continue; }

  const offending = source.split('\n')
    .map((line, i) => ({ line, no: i + 1 }))
    .filter(({ line }) => {
      const t = line.trim();
      return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
    })
    .filter(({ line }) => LAMBDA.some((re) => re.test(line)));
  if (offending.length) {
    failed++;
    for (const { line, no } of offending) {
      console.error(`FAIL  ${path.relative(process.cwd(), file)}:${no} lambda/method reference cannot be compiled by the APK toolchain`);
      console.error(`      ${line.trim()}`);
    }
  }
}
console.log(`${files.length - failed}/${files.length} Java sources parsed cleanly`);
process.exit(failed ? 1 : 0);

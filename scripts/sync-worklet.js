// Keeps the inline fallback copy of capture-worklet.js inside resona.html in sync.
// The page loads capture-worklet.js normally and only uses the inline copy (as a Blob)
// when that file can't be fetched, so the two must never drift apart.
//   node scripts/sync-worklet.js          rewrite the copy in resona.html
//   node scripts/sync-worklet.js --check  exit 1 if the copy is out of date (used in CI)
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const pagePath = path.join(root, 'resona.html');
const BEGIN = '/* capture-worklet.js:begin */';
const END = '/* capture-worklet.js:end */';

const worklet = fs.readFileSync(path.join(root, 'capture-worklet.js'), 'utf8')
  .replace(/\r\n/g, '\n')
  .replace(/^\/\/ Keep in sync.*\n/, '')
  .trimEnd() + '\n';
if (/`|\$\{/.test(worklet)) {
  console.error('capture-worklet.js contains ` or ${, which would break the inline template literal');
  process.exit(1);
}

const page = fs.readFileSync(pagePath, 'utf8');
const a = page.indexOf(BEGIN), b = page.indexOf(END);
if (a < 0 || b < a) { console.error('markers not found in resona.html'); process.exit(1); }
const next = page.slice(0, a + BEGIN.length) + '\n' + worklet + page.slice(b);

if (process.argv.includes('--check')) {
  if (next.replace(/\r\n/g, '\n') !== page.replace(/\r\n/g, '\n')) {
    console.error('resona.html: inline worklet copy is out of date. Run: npm run sync-worklet');
    process.exit(1);
  }
  console.log('inline worklet copy is in sync');
} else if (next !== page) {
  fs.writeFileSync(pagePath, next);
  console.log('resona.html: inline worklet copy updated');
} else {
  console.log('inline worklet copy already in sync');
}

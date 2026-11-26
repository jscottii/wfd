// Copies the page recipe reader (src/lib/readrecipe.js) into the proxy Edge Function, which is deployed as one file.
import { readFileSync, writeFileSync } from 'node:fs';
const src = readFileSync('src/lib/readrecipe.js', 'utf8').replace(/^export function/m, 'function');
const p = 'supabase/functions/proxy/index.ts';
const f = readFileSync(p, 'utf8');
const a = f.indexOf('// <readrecipe>'), b = f.indexOf('// </readrecipe>');
const head = f.slice(0, f.indexOf('\n', a) + 1);
writeFileSync(p, head + '// @ts-nocheck: plain JS shared with the app\n' + src + f.slice(b));
console.log('proxy updated');

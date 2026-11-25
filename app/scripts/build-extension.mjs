// Builds the WFD Chrome extension into dist-extension/ (load it unpacked from there) and dist-extension.zip (for the Chrome Web Store).
import { build } from 'esbuild';
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';
const out = 'dist-extension';
rmSync(out, { recursive: true, force: true }); mkdirSync(out);
await build({ entryPoints: ['extension/src/popup.js'], bundle: true, minify: true, format: 'iife', target: 'chrome110', outfile: `${out}/popup.js`, define: { __APP_VERSION__: '"extension"' }, logLevel: 'warning' });
for (const f of ['manifest.json', 'popup.html', 'popup.css', 'icons']) cpSync(`extension/${f}`, `${out}/${f}`, { recursive: true });
execSync(`cd ${out} && rm -f ../dist-extension.zip && zip -qr ../dist-extension.zip .`);
console.log('built', out, 'and dist-extension.zip');

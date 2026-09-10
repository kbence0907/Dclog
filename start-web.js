// Starts the Next.js web search UI as a child process, on the single port
// the hosting panel exposes (default 40008, since that's what most panels
// like this one assign). Builds it once on first boot if no build exists yet
// — panels with no shell access can't run `npm run web:build` by hand.
const path = require('path');
const fs = require('fs');
const { spawn, execFileSync } = require('child_process');

const WEB_DIR = path.join(__dirname, 'packages', 'web');
const PORT = process.env.PORT || process.env.WEB_PORT || '40008';

function isBuilt() {
  return fs.existsSync(path.join(WEB_DIR, '.next', 'BUILD_ID'));
}

function startWeb() {
  if (!isBuilt()) {
    console.log('[web] Első indítás: Next.js build készítése, ez eltarthat egy percig...');
    try {
      execFileSync('npx', ['next', 'build'], { cwd: WEB_DIR, stdio: 'inherit', env: process.env });
    } catch (err) {
      console.error('[web] Build sikertelen, a weboldal nem indul el. Ellenőrizd a fenti hibaüzenetet.');
      return;
    }
  }

  console.log(`[web] Weboldal indítása a(z) ${PORT} porton...`);
  const child = spawn('npx', ['next', 'start', '-p', String(PORT)], {
    cwd: WEB_DIR,
    stdio: 'inherit',
    env: process.env,
  });

  child.on('exit', (code) => {
    console.error(`[web] A weboldal folyamata leállt (kód: ${code}).`);
  });
}

module.exports = { startWeb };

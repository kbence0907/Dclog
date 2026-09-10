// Starts the Next.js web search UI as a child process, on the single port
// the hosting panel exposes (default 40008).
//
// Everything here is asynchronous on purpose: a synchronous `next build`
// blocks the event loop for a minute or more, which stalls the Discord
// gateway handshake happening at the same time. Web failures are also kept
// isolated — a build that fails or runs out of memory must never take the
// bot down with it.
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const WEB_DIR = path.join(__dirname, 'packages', 'web');
const PORT = process.env.PORT || process.env.WEB_PORT || '40008';

function isBuilt() {
  return fs.existsSync(path.join(WEB_DIR, '.next', 'BUILD_ID'));
}

function nextCliPath() {
  try {
    return require.resolve('next/dist/bin/next');
  } catch (err) {
    console.error('[web] A next csomag nincs telepítve, a weboldal nem indul el. Futtasd az `npm install`-t.');
    return null;
  }
}

function runNext(args, onExit) {
  const cli = nextCliPath();
  if (!cli) return;

  // Runs through the current node binary rather than `npx`, which isn't
  // always on PATH inside hosting containers.
  const child = spawn(process.execPath, [cli, ...args], {
    cwd: WEB_DIR,
    stdio: 'inherit',
    env: process.env,
  });

  child.on('error', (err) => {
    console.error(`[web] A folyamat nem indítható (next ${args[0]}):`, err.message);
  });
  child.on('exit', (code) => onExit(code));
}

function startServer() {
  console.log(`[web] Weboldal indítása a(z) ${PORT} porton...`);
  runNext(['start', '-p', String(PORT)], (code) => {
    console.error(`[web] A weboldal folyamata leállt (kód: ${code}). A bot ettől függetlenül tovább fut.`);
  });
}

function startWeb() {
  if (process.env.WEB_ENABLED === 'false') {
    console.log('[web] A weboldal ki van kapcsolva (WEB_ENABLED=false), csak a bot fut.');
    return;
  }

  if (isBuilt()) {
    startServer();
    return;
  }

  console.log('[web] Első indítás: Next.js build készítése a háttérben, ez eltarthat néhány percig...');
  runNext(['build'], (code) => {
    if (code === 0) {
      startServer();
    } else {
      console.error(`[web] A build sikertelen (kód: ${code}), a weboldal nem indul el. A bot tovább fut.`);
      console.error('[web] Kevés memóriájú gépen a build elfogyaszthatja a RAM-ot — ilyenkor állítsd be a');
      console.error('      WEB_ENABLED=false változót, hogy csak a bot fusson.');
    }
  });
}

module.exports = { startWeb };

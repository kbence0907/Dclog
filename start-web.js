// Starts the Next.js web search UI as a child process, on the single port
// the hosting panel exposes.
//
// Everything here is asynchronous on purpose: a synchronous `next build`
// blocks the event loop for a minute or more, which stalls the Discord
// gateway handshake happening at the same time. Web failures are also kept
// isolated — a build that fails or runs out of memory must never take the
// bot down with it.
const path = require('path');
const fs = require('fs');
const net = require('net');
const { spawn } = require('child_process');

const WEB_DIR = path.join(__dirname, 'packages', 'web');

// SERVER_PORT / SERVER_IP are what Pterodactyl- and Pelican-style panels
// inject for the allocation they expose; prefer those over the fallback so
// the site lands on the port the panel actually routes to.
const PORT = process.env.WEB_PORT || process.env.SERVER_PORT || process.env.PORT || '40008';
const HOSTNAME = process.env.WEB_HOSTNAME || '0.0.0.0';

function isBuilt() {
  return fs.existsSync(path.join(WEB_DIR, '.next', 'BUILD_ID'));
}

function nextCliPath() {
  try {
    return require.resolve('next/dist/bin/next');
  } catch (err) {
    console.error('[web] ❌ A next csomag nincs telepítve, a weboldal nem indul el. Futtasd az `npm install`-t.');
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
    console.error(`[web] ❌ A folyamat nem indítható (next ${args[0]}):`, err.message);
  });
  child.on('exit', (code, signal) => onExit(code, signal));
}

// Confirms from the outside that something is actually accepting connections
// on the port, so the console says whether the site is reachable rather than
// only that a process was launched.
function verifyListening(attempt = 1) {
  const socket = net.connect({ host: '127.0.0.1', port: Number(PORT) }, () => {
    socket.end();
    console.log(`[web] ✅ A weboldal elérhető a(z) ${PORT} porton.`);
    console.log(`[web]    Nyisd meg a panelen látható címet, ezzel a porttal: http://<szerver-cím>:${PORT}`);
  });
  socket.on('error', () => {
    socket.destroy();
    if (attempt < 10) {
      setTimeout(() => verifyListening(attempt + 1), 3000);
    } else {
      console.error(`[web] ❌ 30 másodperc után sem figyel semmi a(z) ${PORT} porton — a weboldal nem indult el.`);
      console.error('[web]    Görgess feljebb a konzolon a Next.js hibaüzenetért.');
    }
  });
}

function startServer() {
  console.log(`[web] Weboldal indítása: ${HOSTNAME}:${PORT} ...`);
  verifyListening();
  runNext(['start', '-p', String(PORT), '-H', HOSTNAME], (code, signal) => {
    console.error(`[web] ❌ A weboldal folyamata leállt (kód: ${code}${signal ? `, jel: ${signal}` : ''}).`);
    if (signal === 'SIGKILL') {
      console.error('[web]    SIGKILL általában azt jelenti, hogy elfogyott a memória a csomagon.');
    }
    console.error('[web]    A bot ettől függetlenül tovább fut.');
  });
}

function startWeb() {
  if (process.env.WEB_ENABLED === 'false') {
    console.log('[web] A weboldal ki van kapcsolva (WEB_ENABLED=false), csak a bot fut.');
    return;
  }

  if (isBuilt()) {
    console.log('[web] Meglévő build megtalálva.');
    startServer();
    return;
  }

  console.log('[web] Nincs kész build — Next.js build indítása a háttérben, ez több percig is tarthat.');
  console.log('[web] (A bot ettől függetlenül már működik, a build nem blokkolja.)');
  runNext(['build'], (code, signal) => {
    if (code === 0) {
      console.log('[web] ✅ Build kész.');
      startServer();
      return;
    }
    console.error(`[web] ❌ A build sikertelen (kód: ${code}${signal ? `, jel: ${signal}` : ''}), a weboldal nem indul el.`);
    if (signal === 'SIGKILL' || code === 137) {
      console.error('[web]    Elfogyott a memória a build közben. A Next.js buildhez kb. 1 GB RAM kell.');
    }
    console.error('[web]    Ha a csomagod kevés ehhez, állítsd be a WEB_ENABLED=false változót,');
    console.error('[web]    így csak a bot fut, a weboldal nélkül.');
  });
}

module.exports = { startWeb };

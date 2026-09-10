const path = require('path');
const { spawnSync } = require('child_process');

const SCHEMA_PATH = path.join(__dirname, 'prisma', 'schema.prisma');

/**
 * Applies any pending Prisma migrations to the configured database. Called
 * once at bot startup so a single "Start" on a hosting panel (no shell
 * access, only a startup command) is enough to bring the schema up to date.
 *
 * Runs the Prisma CLI through the current node binary instead of `npx`:
 * hosting containers don't always have npx on PATH, and npx may try to reach
 * the network before falling back to the local install.
 */
function ensureDatabaseMigrated() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ Hiányzik a DATABASE_URL környezeti változó — enélkül nincs adatbázis, a bot nem tud elindulni.');
    console.error('   Példa: DATABASE_URL="mysql://felhasznalo:jelszo@host:3306/adatbazis"');
    process.exit(1);
  }

  let prismaCli;
  try {
    prismaCli = require.resolve('prisma/build/index.js');
  } catch (err) {
    console.error('❌ A prisma csomag nincs telepítve. Futtasd újra az `npm install`-t (vagy nyomj Reinstall-t a panelen).');
    process.exit(1);
  }

  console.log('[db] Adatbázis táblák ellenőrzése / létrehozása...');
  const result = spawnSync(process.execPath, [prismaCli, 'migrate', 'deploy', '--schema', SCHEMA_PATH], {
    stdio: 'inherit',
    env: process.env,
  });

  if (result.error) {
    console.error('❌ A Prisma CLI nem futtatható:', result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error('❌ Az adatbázis migráció sikertelen (a részletes hiba fentebb látható).');
    console.error('   Ellenőrizd, hogy a DATABASE_URL helyes-e, és hogy az adatbázis elérhető-e.');
    process.exit(1);
  }
}

module.exports = { ensureDatabaseMigrated };

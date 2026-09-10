const path = require('path');
const { execFileSync } = require('child_process');

const SCHEMA_PATH = path.join(__dirname, 'prisma', 'schema.prisma');

/**
 * Applies any pending Prisma migrations to the configured database. Called
 * once at bot startup so a single "Start" on a hosting panel (no shell
 * access, only a startup command) is enough to bring the schema up to date —
 * no manual `npx prisma migrate deploy` step required.
 */
function ensureDatabaseMigrated() {
  try {
    execFileSync('npx', ['prisma', 'migrate', 'deploy', '--schema', SCHEMA_PATH], {
      stdio: 'inherit',
      env: process.env,
    });
  } catch (err) {
    console.error('[migrate] Adatbázis migráció sikertelen, a bot nem indul el. Ellenőrizd a DATABASE_URL-t.');
    process.exit(1);
  }
}

module.exports = { ensureDatabaseMigrated };

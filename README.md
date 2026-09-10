# Dclog

FiveM szerver log gyűjtő és kereső rendszer: egy Discord bot begyűjti az összes
log csatorna tartalmát egy MySQL adatbázisba, és akár Discordból (`/lookup`),
akár egy weboldalról vissza lehet keresni egy játékos **összes** ismert
adatát — Discord ID, Steam ID, license, citizenid vagy karakternév alapján —
még akkor is, ha a több ezer/óránkénti log üzenetek formátuma csatornánként
és scriptenként eltérő.

## Hogyan működik

1. **Ingestion** (`packages/bot`) — a bot figyeli a beállított log
   csatornákat, minden webhook/bot üzenet minden embedjét feldolgozza, és
   elmenti nyersen (`rawJson`), mezőkre bontva (`LogField`), valamint
   kinyeri belőle az azonosítókat (`LogIdentifier`): Discord ID, Steam,
   license/license2, xbl/live/fivem, IP, citizenid, szerver slot ID,
   karakternév.

   Mivel a logokat sok különböző, egymástól független script küldi
   (más-más embed struktúrával), a kinyerés **nem** egy fix mezőnévre épít,
   hanem:
   - a FiveM saját `steam:`/`license:`/`discord:`/... azonosító-formátumát
     keresi regexszel a teljes szövegben (title, description, minden mező,
     footer) — ez szinte minden logoló scriptben ugyanaz, mert maga a játék
     adja ezt a formátumot;
   - Discord mention-öket (`<@id>`) mindig felismeri;
   - névvel ellátott mezőket (pl. `Name`, `CitizenID`, `Player ID`) alias-lista
     alapján próbál azonosítani.

   Emiatt egy log akkor is kereshető lesz, ha csak részleges információt
   tartalmaz (pl. csak Discord ID-t, vagy csak citizenid-t).

2. **Identitás-összekötés** (`packages/db/lookup.js`) — ez a rendszer
   szíve. Amikor rákeresel egy értékre (pl. egy Discord ID-ra), a rendszer
   megkeresi az összes log bejegyzést, ami tartalmazza, majd ezekből
   kigyűjti az **összes egyéb** azonosítót, ami valaha együtt szerepelt vele
   (pl. ugyanabban a kick logban a Steam ID, license, citizenid is benne
   volt). Ezt több körben (max 5 "hop") ismétli, amíg új azonosító elő nem
   kerül. Így 400 óra / ~100 000 log esetén sem kell tudnod, melyik
   azonosítóval van pont az adott log megjelölve — bármelyiket beírod,
   mindent megtalál, ami hozzá köthető.

   Fontos: a szerver slot ID és az IP cím **nincs** bevonva az
   összekötésbe, mert ezek több játékos között is újrafelhasználódnak
   (slot: session-önként újraosztva; IP: megosztott hálózat/VPN) — ezek
   bevonása téves összefésüléshez vezetne.

3. **Discord `/lookup`** és **weboldal** — mindkettő ugyanazt a
   `lookupPlayer()` függvényt hívja a `@dclog/db` csomagból, tehát a
   keresési logika egy helyen van.

## Projekt felépítés

```
packages/
  db/    → Prisma séma (MySQL) + megosztott lookup/identifier logika
  bot/   → Discord bot: log gyűjtés, backfill, /lookup, /logchannel, /backfill
  web/   → Next.js weboldal: Discord OAuth login + kereső felület
```

## Beüzemelés

### 1. Discord alkalmazás létrehozása

- Hozz létre egy alkalmazást a https://discord.com/developers/applications oldalon.
- **Bot**: kapcsold be a `MESSAGE CONTENT INTENT`-et, hívd meg a szerverre
  `applications.commands` + `bot` scope-okkal (Read Messages/View Channels,
  Read Message History legalább).
- **OAuth2**: állíts be egy redirect URL-t a weboldalhoz:
  `http://localhost:3000/api/auth/callback/discord` (élesben a saját
  domainnel).

### 2. Környezeti változók

```bash
cp .env.example .env
```

Töltsd ki: `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`,
`DISCORD_GUILD_ID`, opcionálisan `STAFF_ROLE_ID` (ha csak bizonyos role-lal
rendelkezők léphetnek be a weboldalra), és `NEXTAUTH_SECRET`
(`openssl rand -base64 32`).

### 3. Adatbázis

```bash
docker compose up -d mysql
npm install
npm run db:migrate     # létrehozza a táblákat
npm run db:generate    # (a migrate ezt is lefuttatja, de külön is lehet)
```

### 4. Slash parancsok regisztrálása és a bot indítása

```bash
npm run bot:deploy-commands
npm run bot:dev
```

A szerveren belül:

```
/logchannel add channel:#ban-logs name:Halál
/logchannel add channel:#kick-logs name:Kirúgás
...
/backfill startall
```

A `name` paraméter opcionális: ha a Discord csatorna neve nem árulja el, mit
logol (pl. generikus vagy random névvel jött létre), itt adhatsz neki saját
címkét, amit a `/logchannel list`, a `/lookup` és a weboldal is ezután ez
alapján jelenít meg. Utólag is módosítható: `/logchannel rename channel:#... name:Új címke`.

A `/backfill startall` az összes eddig hozzáadott, még be nem gyűjtött log
csatornát sorban, egyesével feldolgozza a háttérben — ezzel biztosítható,
hogy a bot bekapcsolása előtt keletkezett, meglévő logok is bekerüljenek az
adatbázisba, nem csak az ezután érkezők. Egy adott csatornát külön is
indíthatsz: `/backfill start #csatorna`, és `/backfill status #csatorna`-val
ellenőrizheted az állapotát (vagy `/logchannel list`-tel mindet egyszerre).

A `/backfill` a háttérben fut és folyamatosan küld státuszüzenetet abba a
csatornába, ahonnan indítottad — nagy (100 000+ üzenetes) csatornáknál ez
akár órákig is eltarthat, de megszakítás után onnan folytatja, ahol
abbamaradt.

### 5. Weboldal

```bash
npm run web:dev
```

Nyisd meg a `http://localhost:3000` címet, jelentkezz be Discorddal, és
keress rá bármilyen azonosítóra vagy karakternévre.

## Skálázás / további bővítési pontok

- Az adatbázis minden azonosítón (`guildId, type, value`) és log
  időbélyegen indexelt, így 100 000+ log/szerver mellett is gyors marad a
  keresés.
- Több szerver (guild) egyszerre is támogatott az adatmodellben; a
  weboldal jelenleg egy elsődleges guildre van beállítva (`DISCORD_GUILD_ID`),
  de a keresés API guild-szinten szűr, így könnyen bővíthető guild-választóval.
- A nyers embed JSON mindig megmarad (`rawJson`), így később bármikor
  visszamenőleg is lehet finomítani az azonosító-kinyerő logikát anélkül,
  hogy adatot vesztenél.

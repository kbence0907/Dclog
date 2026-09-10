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
docker compose up -d mysql   # vagy egy saját MySQL/MariaDB szerver
npm install
```

A `npm install` automatikusan lefuttatja a `prisma generate`-et is
(`postinstall` script), a **táblák létrehozása pedig magától megtörténik,
amikor a bot elindul** — nincs szükség kézi `npm run db:migrate` parancsra.
Ez olyan hosztingpaneleknél is működik, ahol nem tudsz szabadon parancsokat
futtatni, csak Start/Stop gombot nyomni: elég, ha helyesen be van állítva a
`DATABASE_URL`, a bot induláskor magától létrehozza/frissíti a táblákat
(`prisma migrate deploy`), mielőtt bejelentkezne Discordra.

Neked csak annyi a dolgod, hogy magát az üres adatbázist (`dclog` séma) és
egy hozzáférő felhasználót létrehozz a MySQL szerveren — a táblákat már nem
kell.

### 4. Indítás

**Hosztingpaneleken (Pterodactyl/Pelican-szerű, ahol csak egy Start/Stop
gombod és egy kiosztott portod van):**

```
node bot.js
```

Ez az **egyetlen** parancs mindent elindít, egy processzben:
1. létrehozza/frissíti az adatbázis táblákat (`prisma migrate deploy`),
2. regisztrálja a slash parancsokat Discordnál,
3. bejelentkezik a Discord botként,
4. lebuildeli (ha még nincs meg) és elindítja a weboldalt is, ugyanabban a
   folyamatban, a panel kiosztott portján.

A weboldal alapértelmezetten a **40008**-as porton fut. Ha a panelen más
port van kiosztva, állítsd be `PORT` vagy `WEB_PORT` környezeti változóként
— akkor azt használja 40008 helyett.

Ha a bot bejelentkezése bármiért sikertelen (rossz token, átmeneti Discord
hiba), az csak logolva lesz, a folyamat és a weboldal **nem áll le** miatta.

Ha a hosztingpaneled csak rövid (pl. max 16 karakteres) fájlnevet fogad el
indítófájlnak: `bot.js` pontosan 6 karakter, tehát ez már eleve megfelel.

**Helyi fejlesztéshez** (két külön folyamat, külön porton, gyorsabb
újratöltéssel):

```bash
npm run bot:dev    # csak a bot
npm run web:dev     # csak a weboldal, http://localhost:3000
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

### 5. Weboldal használata

Nyisd meg a panel/domain címét (pl. `http://host-voidhost.hu:40008`,
helyi fejlesztésben `http://localhost:3000`), jelentkezz be Discorddal, és
keress rá bármilyen azonosítóra vagy karakternévre.

Ha frissíted a `packages/web` kódját egy már futó, egyprocesszes (`node
bot.js`) telepítésen, a weboldal nem buildeli újra magát automatikusan —
töröld a `packages/web/.next` mappát és indítsd újra, hogy a következő
indítás lebuildelje az új verziót.

## Hibakeresés

**Nem látom a slash parancsokat Discordon.**
- A bot induláskor kiírja a konzolra, hogy sikerült-e a regisztráció, és ha
  nem, hogy miért. Nézd meg a panel konzolját.
- Ha nincs beállítva a `DISCORD_GUILD_ID`, a parancsok **globálisan**
  regisztrálódnak, ami akár 1 órát is igénybe vehet. Állítsd be a szervered
  ID-jére, akkor azonnal megjelennek.
- A botot `applications.commands` scope-pal is meg kell hívni, nem elég a
  `bot` scope. A bot induláskor kiír egy kész meghívó linket a konzolra —
  nyisd meg azt.
- A `/logchannel` és `/backfill` parancsok **csak** a "Szerver kezelése"
  (Manage Server) jogosultsággal rendelkező tagoknak látszanak. A `/lookup`
  mindenkinek.

**A bot elindul, de nem jelentkezik be ("Discord bejelentkezés sikertelen").**
- Kapcsold be a Developer Portal → Bot oldalon a **MESSAGE CONTENT INTENT**-et
  (privilegizált intent, alapból ki van kapcsolva) — enélkül a bot nem tudja
  olvasni a log üzenetek tartalmát.
- Ellenőrizd a `DISCORD_TOKEN` értékét (Reset Token után új értéket kapsz).

**"Az adatbázis migráció sikertelen" / a folyamat kilép induláskor.**
- Rossz vagy hiányzó `DATABASE_URL`, vagy az adatbázis nem érhető el.
  A pontos Prisma hibaüzenet a konzolon látható közvetlenül a hiba felett.

**A weboldal nem jön fel, vagy elfogy a memória induláskor.**
- Az első indításnál lefut egy Next.js build, ami memóriaigényes. Kis
  csomagon ez elszállhat. Ilyenkor állítsd be a `WEB_ENABLED=false`
  változót: akkor csak a bot fut, a weboldal nélkül.
- A build és a weboldal hibái **nem** állítják le a botot.

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

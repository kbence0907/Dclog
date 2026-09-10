require('./env');
const { Client, GatewayIntentBits, Collection, Partials, REST, Routes, Events } = require('discord.js');
const { ensureDatabaseMigrated } = require('@dclog/db');
const onMessageCreate = require('./events/messageCreate');
const onInteractionCreate = require('./events/interactionCreate');
const { commandModules } = require('./commands');

if (!process.env.DISCORD_TOKEN) {
  console.error('❌ Hiányzik a DISCORD_TOKEN környezeti változó — a bot nem tud bejelentkezni.');
  process.exit(1);
}

// Brings the database schema up to date before doing anything else, so a
// plain "Start" on a hosting panel is enough — no shell access needed to run
// `npx prisma migrate deploy` by hand.
ensureDatabaseMigrated();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  partials: [Partials.Message, Partials.Channel],
});

const commands = new Collection();
for (const cmd of commandModules) {
  commands.set(cmd.data.name, cmd);
}

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

// The bot token alone identifies the application, so the client id doesn't
// have to be configured separately — one less env var to get wrong.
async function resolveApplicationId() {
  if (process.env.DISCORD_CLIENT_ID) return process.env.DISCORD_CLIENT_ID;
  const application = await rest.get(Routes.oauth2CurrentApplication());
  return application.id;
}

/**
 * Registers the slash commands over REST. Deliberately NOT tied to the
 * gateway connection: if logging in fails (e.g. privileged intents are still
 * switched off in the Developer Portal), the commands should still land, and
 * the reason for the failure should be visible on its own.
 */
async function registerSlashCommands() {
  try {
    const applicationId = await resolveApplicationId();
    const body = commandModules.map((cmd) => cmd.data.toJSON());
    const guildId = process.env.DISCORD_GUILD_ID;

    await rest.put(
      guildId ? Routes.applicationGuildCommands(applicationId, guildId) : Routes.applicationCommands(applicationId),
      { body }
    );

    if (guildId) {
      console.log(`✅ ${body.length} slash parancs regisztrálva a(z) ${guildId} szerveren (azonnal használható).`);
    } else {
      console.log(`✅ ${body.length} slash parancs globálisan regisztrálva.`);
      console.log('ℹ️  Globális parancsok megjelenése akár 1 órát is igénybe vehet. Ha azonnal kellenek,');
      console.log('   állítsd be a DISCORD_GUILD_ID környezeti változót a szervered ID-jére és indítsd újra.');
    }

    console.log(
      `ℹ️  Ha nem látod a parancsokat Discordon, hívd meg újra a botot ezzel a linkkel:\n` +
        `   https://discord.com/oauth2/authorize?client_id=${applicationId}&scope=bot%20applications.commands&permissions=66560`
    );
  } catch (err) {
    console.error('❌ A slash parancsok regisztrálása sikertelen:', err.message);
    if (err.status === 401) {
      console.error('   A DISCORD_TOKEN érvénytelen. Másold be újra a Developer Portal → Bot → Reset Token értékét.');
    } else if (err.status === 403) {
      console.error('   A botnak nincs jogosultsága parancsot regisztrálni ezen a szerveren.');
      console.error('   Hívd meg újra a botot az `applications.commands` scope-pal is (nem elég a `bot` scope).');
    } else if (err.status === 404) {
      console.error('   Nincs ilyen szerver, vagy a bot nincs rajta. Ellenőrizd a DISCORD_GUILD_ID értékét.');
    }
  }
}

client.once(Events.ClientReady, () => {
  console.log(`✅ Bejelentkezve mint ${client.user.tag}`);
});

client.on(Events.MessageCreate, onMessageCreate);
client.on(Events.InteractionCreate, (interaction) => onInteractionCreate(interaction, commands));

client.login(process.env.DISCORD_TOKEN).catch((err) => {
  console.error('❌ Discord bejelentkezés sikertelen:', err.message);
  if (/disallowed intents/i.test(err.message)) {
    console.error('   Kapcsold be a Developer Portal → Bot oldalon a MESSAGE CONTENT INTENT-et');
    console.error('   (és a SERVER MEMBERS INTENT-et), majd indítsd újra a botot.');
  } else {
    console.error('   Ellenőrizd a DISCORD_TOKEN értékét.');
  }
});

// Registered independently of the gateway login above, so a login problem
// never silently costs you the slash commands.
registerSlashCommands();

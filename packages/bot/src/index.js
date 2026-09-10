require('./env');
const { Client, GatewayIntentBits, Collection, Partials, REST, Routes } = require('discord.js');
const { ensureDatabaseMigrated } = require('@dclog/db');
const onMessageCreate = require('./events/messageCreate');
const onInteractionCreate = require('./events/interactionCreate');
const { commandModules } = require('./commands');

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

// Registers the slash commands with Discord on every boot, the same way
// `npm run bot:deploy-commands` does — so a hosting panel that only offers a
// Start button (no shell access to run that script separately) still ends up
// with working slash commands. Cheap and idempotent: Discord just overwrites
// the existing command set with the same definitions when nothing changed.
async function registerSlashCommands() {
  try {
    const rest = new REST().setToken(process.env.DISCORD_TOKEN);
    const body = commandModules.map((cmd) => cmd.data.toJSON());
    const route = process.env.DISCORD_GUILD_ID
      ? Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.DISCORD_GUILD_ID)
      : Routes.applicationCommands(process.env.DISCORD_CLIENT_ID);

    await rest.put(route, { body });
    console.log(`✅ ${body.length} slash parancs regisztrálva.`);
  } catch (err) {
    console.error('[commands] slash parancsok regisztrálása sikertelen:', err);
  }
}

client.once('ready', async () => {
  console.log(`✅ Bejelentkezve mint ${client.user.tag}`);
  await registerSlashCommands();
});

client.on('messageCreate', onMessageCreate);
client.on('interactionCreate', (interaction) => onInteractionCreate(interaction, commands));

// Without this .catch, a login failure (bad token, Discord API hiccup,
// network issue) becomes an unhandled rejection that crashes the whole
// process — including the web UI, since both now run together in bot.js.
client.login(process.env.DISCORD_TOKEN).catch((err) => {
  console.error('❌ Discord bejelentkezés sikertelen. Ellenőrizd a DISCORD_TOKEN értékét:', err.message);
});

// Optional standalone way to (re-)register slash commands without starting
// the whole bot. Not required for normal operation — the bot registers its
// commands automatically on every boot (see index.js) — but handy for a
// one-off manual refresh from a machine with shell access.
require('./env');
const { REST, Routes } = require('discord.js');
const { commandModules } = require('./commands');

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    const applicationId =
      process.env.DISCORD_CLIENT_ID || (await rest.get(Routes.oauth2CurrentApplication())).id;
    const body = commandModules.map((cmd) => cmd.data.toJSON());
    const guildId = process.env.DISCORD_GUILD_ID;

    await rest.put(
      guildId ? Routes.applicationGuildCommands(applicationId, guildId) : Routes.applicationCommands(applicationId),
      { body }
    );
    console.log(`✅ ${body.length} slash parancs regisztrálva${guildId ? ` a(z) ${guildId} szerveren` : ' globálisan'}.`);
  } catch (err) {
    console.error('❌ Sikertelen:', err.message);
    process.exit(1);
  }
})();

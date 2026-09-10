// Optional standalone way to (re-)register slash commands without starting
// the whole bot. Not required for normal operation — the bot registers its
// commands automatically on every boot (see index.js) — but handy for a
// one-off manual refresh from a machine with shell access.
require('./env');
const { REST, Routes } = require('discord.js');
const { commandModules } = require('./commands');

const commands = commandModules.map((cmd) => cmd.data.toJSON());

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    const route = process.env.DISCORD_GUILD_ID
      ? Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.DISCORD_GUILD_ID)
      : Routes.applicationCommands(process.env.DISCORD_CLIENT_ID);

    await rest.put(route, { body: commands });
    console.log(`✅ ${commands.length} slash parancs regisztrálva.`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();

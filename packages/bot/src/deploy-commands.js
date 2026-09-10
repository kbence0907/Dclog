require('./env');
const { REST, Routes } = require('discord.js');
const logchannel = require('./commands/logchannel');
const backfill = require('./commands/backfill');
const lookup = require('./commands/lookup');

const commands = [logchannel.data.toJSON(), backfill.data.toJSON(), lookup.data.toJSON()];

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

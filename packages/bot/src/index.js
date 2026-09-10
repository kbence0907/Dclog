require('./env');
const { Client, GatewayIntentBits, Collection, Partials } = require('discord.js');
const onMessageCreate = require('./events/messageCreate');
const onInteractionCreate = require('./events/interactionCreate');

const logchannel = require('./commands/logchannel');
const backfill = require('./commands/backfill');
const lookup = require('./commands/lookup');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  partials: [Partials.Message, Partials.Channel],
});

const commands = new Collection();
for (const cmd of [logchannel, backfill, lookup]) {
  commands.set(cmd.data.name, cmd);
}

client.once('ready', () => {
  console.log(`✅ Bejelentkezve mint ${client.user.tag}`);
});

client.on('messageCreate', onMessageCreate);
client.on('interactionCreate', (interaction) => onInteractionCreate(interaction, commands));

client.login(process.env.DISCORD_TOKEN);

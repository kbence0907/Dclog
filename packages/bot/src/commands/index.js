const logchannel = require('./logchannel');
const backfill = require('./backfill');
const lookup = require('./lookup');

const commandModules = [logchannel, backfill, lookup];

module.exports = { commandModules };

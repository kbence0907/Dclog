const { prisma } = require('./client');
const lookup = require('./lookup');
const { extractIdentifiers } = require('./identifiers');
const { ensureDatabaseMigrated } = require('./migrate');

module.exports = {
  prisma,
  extractIdentifiers,
  ensureDatabaseMigrated,
  ...lookup,
};

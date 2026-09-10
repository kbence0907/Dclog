const { prisma } = require('./client');
const lookup = require('./lookup');
const { extractIdentifiers } = require('./identifiers');

module.exports = {
  prisma,
  extractIdentifiers,
  ...lookup,
};

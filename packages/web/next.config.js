const path = require('path');

// Single .env file lives at the monorepo root and is shared by bot + web.
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@dclog/db'],
};

module.exports = nextConfig;

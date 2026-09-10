// Single entry point for hosting panels that only expose one Start command
// and one port: launches the Discord bot and the web search UI together in
// one process, with the website listening on the panel's exposed port
// (default 40008, override with PORT or WEB_PORT).
require('./packages/bot/src/index.js');
require('./start-web.js').startWeb();

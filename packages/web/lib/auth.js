import DiscordProvider from 'next-auth/providers/discord';

const GUILD_ID = process.env.DISCORD_GUILD_ID;
const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID;
const BOT_TOKEN = process.env.DISCORD_TOKEN;

export const authOptions = {
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    // Only let people in who are members of the configured guild and (if set)
    // hold the staff role — this site exposes every player's log history, so
    // access must not be open to arbitrary Discord accounts.
    async signIn({ user }) {
      if (!GUILD_ID || !BOT_TOKEN) return true;
      try {
        const res = await fetch(`https://discord.com/api/v10/guilds/${GUILD_ID}/members/${user.id}`, {
          headers: { Authorization: `Bot ${BOT_TOKEN}` },
        });
        if (!res.ok) return false;
        const member = await res.json();
        if (!STAFF_ROLE_ID) return true;
        return member.roles?.includes(STAFF_ROLE_ID) ?? false;
      } catch (err) {
        console.error('signIn guild check failed:', err);
        return false;
      }
    },
    async jwt({ token, account }) {
      if (account) token.discordId = account.providerAccountId;
      return token;
    },
    async session({ session, token }) {
      session.guildId = GUILD_ID;
      session.discordId = token.discordId;
      return session;
    },
  },
  pages: { signIn: '/login' },
};

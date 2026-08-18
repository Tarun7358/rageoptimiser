import { Client, GatewayIntentBits } from 'discord.js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const token = process.env.DISCORD_TOKEN || process.env.BOT_TOKEN;

if (!token) {
  console.error('❌ DISCORD_TOKEN / BOT_TOKEN not found in .env');
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildEmojisAndStickers]
});

client.once('ready', async () => {
  console.log(`🤖 Logged in as ${client.user?.tag} (${client.user?.id})`);
  console.log(`📊 Connected to ${client.guilds.cache.size} guilds.\n`);

  const emojisByGuild = [];
  const allIcons = {};

  for (const [guildId, guild] of client.guilds.cache) {
    try {
      const fetchedGuild = await guild.fetch();
      const emojis = await fetchedGuild.emojis.fetch();
      console.log(`🏰 Guild: ${fetchedGuild.name} (${fetchedGuild.id}) — ${emojis.size} emojis found`);

      const guildEmojiList = [];
      for (const [id, emoji] of emojis) {
        const format = emoji.animated ? `<a:${emoji.name}:${emoji.id}>` : `<:${emoji.name}:${emoji.id}>`;
        guildEmojiList.push({
          id: emoji.id,
          name: emoji.name,
          animated: emoji.animated,
          formatted: format
        });
        const constName = `${emoji.name.toUpperCase().replace(/[^A-Z0-9_]/g, '_')}_ICON`;
        allIcons[constName] = format;
        console.log(`   ${format}  ->  export const ${constName} = '${format}';`);
      }

      emojisByGuild.push({
        guildId: fetchedGuild.id,
        guildName: fetchedGuild.name,
        emojis: guildEmojiList
      });
    } catch (e) {
      console.error(`❌ Failed to fetch emojis for guild ${guild.name} (${guildId}):`, e.message);
    }
  }

  const outputPath = path.join(__dirname, 'emojis_dump.json');
  fs.writeFileSync(outputPath, JSON.stringify({ guilds: emojisByGuild, allIcons }, null, 2));
  console.log(`\n✅ Saved complete emoji dump to ${outputPath}`);
  process.exit(0);
});

client.login(token).catch(err => {
  console.error('❌ Failed to login:', err);
  process.exit(1);
});

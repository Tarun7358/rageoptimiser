import dotenv from 'dotenv';
import { Client, GatewayIntentBits, AuditLogEvent } from 'discord.js';

dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
  ]
});

client.once('ready', async () => {
  console.log(`Logged in as ${client.user?.tag}`);
  
  const guildId = process.env.GUILD_ID || '1508399161798819840';
  const guild = await client.guilds.fetch(guildId).catch(() => null);
  
  if (!guild) {
    console.error(`Guild not found: ${guildId}`);
    process.exit(1);
  }
  
  console.log(`Guild Owner ID: ${guild.ownerId}`);
  
  try {
    const fetchedLogs = await guild.fetchAuditLogs({ limit: 10, type: AuditLogEvent.ChannelDelete });
    console.log(`Fetched ${fetchedLogs.entries.size} ChannelDelete audit log entries:`);
    
    for (const entry of fetchedLogs.entries.values()) {
      console.log(`- Time: ${entry.createdAt.toISOString()}`);
      console.log(`  Channel ID (Target ID): ${entry.targetId}`);
      console.log(`  Executor: ${entry.executor?.tag} (${entry.executor?.id})`);
      console.log(`  Is Owner: ${entry.executor?.id === guild.ownerId}`);
      console.log(`  Is Bot: ${entry.executor?.id === client.user?.id}`);
      if (entry.changes) {
        console.log(`  Changes: ${JSON.stringify(entry.changes)}`);
      }
    }
  } catch (err) {
    console.error('Failed to fetch audit logs:', err);
  }
  
  process.exit(0);
});

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('No DISCORD_TOKEN found in .env');
  process.exit(1);
}

client.login(token);

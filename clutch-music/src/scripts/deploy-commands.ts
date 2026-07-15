import dotenv from 'dotenv';
import { REST, Routes } from 'discord.js';
import { MusicManifest } from '../modules/music/manifest.js';

dotenv.config();

const token   = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId  = process.env.GUILD_ID;

if (!token || !clientId) {
  console.error('❌ DISCORD_TOKEN and CLIENT_ID must be set in clutch-music/.env');
  process.exit(1);
}

const commands: any[] = [];
(MusicManifest.commands ?? []).forEach((c: any) => {
  commands.push({
    name: c.name,
    description: c.description,
    options: c.options || []
  });
});

console.log(`📋 Commands to deploy (${commands.length}):`);
commands.forEach(c => console.log(`   /${c.name}`));

const rest = new REST({ version: '10' }).setToken(token);

async function deploy() {
  try {
    if (guildId) {
      console.log(`\n🚀 Deploying ${commands.length} commands to guild ${guildId}...`);
      await rest.put(
        Routes.applicationGuildCommands(clientId!, guildId),
        { body: commands }
      );
      console.log('✅ Guild slash commands deployed successfully.');
    } else {
      console.log(`\n🚀 Deploying ${commands.length} commands globally...`);
      await rest.put(
        Routes.applicationCommands(clientId!),
        { body: commands }
      );
      console.log('✅ Global slash commands deployed successfully.');
    }
  } catch (err) {
    console.error('❌ Deploy failed:', err);
    process.exit(1);
  }
}

deploy();

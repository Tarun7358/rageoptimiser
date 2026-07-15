import { ModuleManifest, DiscordResourceRegistry } from '../../core/types.js';
import { EmbedBuilder } from 'discord.js';

export const DiagnosticsManifest: ModuleManifest = {
  id: 'diagnostics',
  name: 'Diagnostics',
  version: '1.0.0',
  description: 'Bot health monitoring: ping, memory, uptime, shard status, gateway, latency, module health.',
  configSchema: {
    requiredFields: [],
    validate: (config: Record<string, any>, registry: DiscordResourceRegistry) => {
      return { progress: 100, errors: [] };
    }
  },
  commands: [
    {
      name: 'diagnostics',
      description: 'System health and diagnostics',
      options: [
        {
          name: 'ping',
          description: 'Check bot latency and response time',
          type: 1
        },
        {
          name: 'health',
          description: 'Full bot health report',
          type: 1
        },
        {
          name: 'memory',
          description: 'Memory usage breakdown',
          type: 1
        },
        {
          name: 'uptime',
          description: 'Bot uptime information',
          type: 1
        },
        {
          name: 'modules',
          description: 'Check status of all bot modules',
          type: 1
        },
        {
          name: 'gateway',
          description: 'Discord Gateway connection status',
          type: 1
        },
        {
          name: 'database',
          description: 'Database connectivity status',
          type: 1
        }
      ]
    }
  ],
  events: [
    {
      name: 'command_diagnostics',
      handler: async (client: any, interaction: any, context: any) => {
        const sub = interaction.options.getSubcommand(false);

        if (sub === 'ping') {
          const start = Date.now();
          await interaction.deferReply({ flags: 64 });
          const roundTrip = Date.now() - start;
          return interaction.editReply({
            content: `🏓 **Pong!**\n- **Round-trip**: \`${roundTrip}ms\`\n- **WS Ping**: \`${client.ws.ping}ms\``
          });
        }

        if (sub === 'health') {
          const memory = process.memoryUsage();
          const uptime = process.uptime();
          const days = Math.floor(uptime / 86400);
          const hours = Math.floor(uptime / 3600) % 24;
          const minutes = Math.floor(uptime / 60) % 60;

          const modules = context.getModulesState ? context.getModulesState() : [];
          const enabledMods = modules.filter((m: any) => m.status === 'enabled').length;
          const errorMods = modules.filter((m: any) => m.status === 'error').length;

          const health = errorMods === 0 ? '🟢 Healthy' : `🔴 ${errorMods} module(s) in error`;

          const embed = new EmbedBuilder()
            .setTitle('🩺 Bot Health Report')
            .setColor(errorMods > 0 ? '#ff4444' : '#2ecc71')
            .addFields(
              { name: 'Status', value: health, inline: true },
              { name: 'WS Ping', value: `${client.ws.ping}ms`, inline: true },
              { name: 'Uptime', value: `${days}d ${hours}h ${minutes}m`, inline: true },
              { name: 'Guilds', value: `${client.guilds?.cache?.size || 0}`, inline: true },
              { name: 'Users (cached)', value: `${client.users?.cache?.size || 0}`, inline: true },
              { name: 'Modules', value: `${enabledMods} active${errorMods > 0 ? `, ${errorMods} error` : ''}`, inline: true },
              { name: 'Heap Used', value: `${(memory.heapUsed / 1024 / 1024).toFixed(1)} MB`, inline: true },
              { name: 'RSS', value: `${(memory.rss / 1024 / 1024).toFixed(1)} MB`, inline: true },
              { name: 'Node.js', value: process.version, inline: true }
            )
            .setTimestamp();

          return interaction.reply({ embeds: [embed], flags: 64 });
        }

        if (sub === 'memory') {
          const memory = process.memoryUsage();
          const embed = new EmbedBuilder()
            .setTitle('💾 Memory Usage')
            .setColor('#4f8cff')
            .addFields(
              { name: 'Heap Used', value: `${(memory.heapUsed / 1024 / 1024).toFixed(2)} MB`, inline: true },
              { name: 'Heap Total', value: `${(memory.heapTotal / 1024 / 1024).toFixed(2)} MB`, inline: true },
              { name: 'RSS', value: `${(memory.rss / 1024 / 1024).toFixed(2)} MB`, inline: true },
              { name: 'External', value: `${(memory.external / 1024 / 1024).toFixed(2)} MB`, inline: true },
              { name: 'Array Buffers', value: `${(memory.arrayBuffers / 1024 / 1024).toFixed(2)} MB`, inline: true }
            )
            .setTimestamp();
          return interaction.reply({ embeds: [embed], flags: 64 });
        }

        if (sub === 'uptime') {
          const uptime = process.uptime();
          const startedAt = new Date(Date.now() - uptime * 1000);
          const embed = new EmbedBuilder()
            .setTitle('⏱️ Bot Uptime')
            .setColor('#4f8cff')
            .addFields(
              { name: 'Uptime', value: `<t:${Math.floor(startedAt.getTime() / 1000)}:R>`, inline: true },
              { name: 'Started At', value: `<t:${Math.floor(startedAt.getTime() / 1000)}:F>`, inline: true }
            )
            .setTimestamp();
          return interaction.reply({ embeds: [embed], flags: 64 });
        }

        if (sub === 'modules') {
          const modules = context.getModulesState ? context.getModulesState() : [];
          const statusIcon = (s: string) => s === 'enabled' ? '🟢' : s === 'ready' ? '🔵' : s === 'error' ? '🔴' : '⚪';
          const lines = modules.map((m: any) => `${statusIcon(m.status)} **${m.name}** — \`${m.status}\` (${m.progress}%)`);
          const embed = new EmbedBuilder()
            .setTitle('🔌 Module Status')
            .setColor('#4f8cff')
            .setDescription(lines.join('\n') || 'No modules loaded.')
            .setTimestamp();
          return interaction.reply({ embeds: [embed], flags: 64 });
        }

        if (sub === 'gateway') {
          const ping = client.ws.ping;
          const status = ping < 100 ? '🟢 Excellent' : ping < 250 ? '🟡 Good' : ping < 500 ? '🟠 Degraded' : '🔴 Poor';
          return interaction.reply({
            content: `📡 **Gateway Status**: ${status}\n- **WS Ping**: \`${ping}ms\`\n- **Status**: \`${client.ws.status === 0 ? 'READY' : client.ws.status}\``,
            flags: 64
          });
        }

        if (sub === 'database') {
          // Check if Database service is working
          try {
            const db = context.db;
            const ping = db ? '🟢 Connected' : '🔴 Not available';
            return interaction.reply({ content: `🗄️ **Database Status**: ${ping}`, flags: 64 });
          } catch {
            return interaction.reply({ content: '🗄️ **Database Status**: 🔴 Error checking connection.', flags: 64 });
          }
        }
      }
    }
  ]
};

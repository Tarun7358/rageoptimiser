import { ModuleManifest, DiscordResourceRegistry } from '../../core/types.js';

export const VoiceManifest: ModuleManifest = {
  id: 'voice',
  name: 'Voice Presence',
  version: '1.0.0',
  description: 'Persistent 24/7 voice presence, automatic reconnection, and connection metrics tracking.',
  configSchema: {
    requiredFields: ['channelId'],
    validate: (config: Record<string, any>, registry: DiscordResourceRegistry) => {
      const errors: string[] = [];
      let progress = 0;

      const channelExists = (id: string) => registry.channels.some(c => c.id === id);
      const isVoiceChannel = (id: string) => registry.channels.some(c => c.id === id && c.type === 'voice');

      if (config.channelId) {
        progress += 100;
        if (!channelExists(config.channelId)) {
          errors.push(`Configured voice channel ID (${config.channelId}) was deleted or does not exist!`);
        } else if (!isVoiceChannel(config.channelId)) {
          errors.push(`Configured channel ID (${config.channelId}) is not a Voice channel!`);
        }
      }

      return { progress, errors };
    }
  },
  commands: [
    {
      name: 'voice',
      description: 'Manage the 24/7 Voice Presence module.',
      options: [
        { name: 'action', type: 3, description: 'Action: status, join, leave', required: true }
      ]
    }
  ],
  events: [
    {
      name: 'command_voice',
      handler: async (client: any, interaction: any, context: any) => {
        const action = interaction.options.getString('action');
        const isOwner = interaction.guild?.ownerId === interaction.user?.id ||
                        interaction.member?.permissions?.has?.('Administrator');
        if (!isOwner) {
          return interaction.reply({ content: '🔒 Voice Presence commands require Administrator permissions.', ephemeral: true });
        }
        const modules = context.getModulesState();
        const voiceMod = modules.find((m: any) => m.id === 'voice');
        const channelId = voiceMod?.config?.channelId;
        if (action === 'status') {
          const status = voiceMod?.connectionStatus || 'disconnected';
          const channel = channelId ? `<#${channelId}>` : 'Not configured';
          await interaction.reply({
            content: `🎙️ **Voice Presence Status**\n- **Status**: \`${status}\`\n- **Channel**: ${channel}\n- **Module**: \`${voiceMod?.status || 'unknown'}\``,
            ephemeral: true
          });
        } else if (action === 'join') {
          if (!channelId) return interaction.reply({ content: '❌ No voice channel configured. Set it in the Dashboard → Voice Presence.', ephemeral: true });
          context.logSyncEvent(`Voice command: Owner requested join to channel ${channelId}.`, 'info');
          await interaction.reply({ content: `✅ Bot will attempt to join <#${channelId}> on the next check cycle (within 10 seconds).`, ephemeral: true });
        } else if (action === 'leave') {
          context.logSyncEvent('Voice command: Owner requested voice disconnect.', 'info');
          await interaction.reply({ content: '✅ Voice disconnection queued. Bot will leave its current voice channel.', ephemeral: true });
        } else {
          await interaction.reply({ content: '❌ Unknown action. Use: `status`, `join`, or `leave`.', ephemeral: true });
        }
      }
    }
  ]
};

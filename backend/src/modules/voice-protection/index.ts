import { ModuleManifest, DiscordResourceRegistry } from '../../core/types.js';
import { DEFAULT_CONFIG } from './config.js';
import { VoiceProtectionCommands, handleVoiceProtectionSlashCommand } from './commands.js';
import { handleVoiceStateUpdate, updateVoiceChannelConnection } from './detector.js';
import { startAnalysisLoop } from './analyzer.js';
import { runMuteCheck } from './scheduler.js';
import { VoiceProtectionRoutes } from './dashboard.js';

export const VoiceProtectionManifest: ModuleManifest = {
  id: 'voice-protection',
  name: 'Voice Protection',
  version: '1.0.0',
  description: 'Protects voice channels from screaming, ear-rape, and excessive volume by auto-muting offenders.',
  configSchema: {
    requiredFields: [],
    validate: (config: Record<string, any>, registry: DiscordResourceRegistry) => {
      const errors: string[] = [];
      if (config.threshold !== undefined && (config.threshold < 0 || config.threshold > 100)) {
        errors.push('Threshold must be between 0 and 100.');
      }
      if (config.duration !== undefined && config.duration < 1) {
        errors.push('Duration must be at least 1 second.');
      }
      if (config.muteDuration !== undefined && config.muteDuration < 1) {
        errors.push('Mute duration must be at least 1 second.');
      }
      return { progress: 100, errors };
    }
  },
  commands: VoiceProtectionCommands,
  events: [
    {
      name: 'command_voiceprotection',
      handler: async (client: any, interaction: any, context: any) => {
        // Ensure analysis loop is active
        startAnalysisLoop(client, (gId) => context.getModulesState(gId), context);
        await handleVoiceProtectionSlashCommand(client, interaction, context);
      }
    },
    {
      name: 'voiceStateUpdate',
      handler: async (client: any, data: any, context: any) => {
        const { oldState, newState } = data;
        const modules = context.getModulesState ? context.getModulesState() : [];
        const vpMod = modules.find((m: any) => m.id === 'voice-protection');
        if (!vpMod) return;

        // Ensure analysis loop is active
        startAnalysisLoop(client, (gId) => context.getModulesState(gId), context);

        const config = { ...DEFAULT_CONFIG, ...(vpMod.config || {}) };
        await handleVoiceStateUpdate(client, oldState, newState, config, context);
      }
    },
    {
      name: 'tick',
      handler: async (client: any, context: any) => {
        const modules = context.getModulesState ? context.getModulesState() : [];
        const vpMod = modules.find((m: any) => m.id === 'voice-protection');
        if (!vpMod) return;

        // Ensure analysis loop is active
        startAnalysisLoop(client, (gId) => context.getModulesState(gId), context);

        const config = { ...DEFAULT_CONFIG, ...(vpMod.config || {}) };
        await runMuteCheck(client, context.guildId, config, context);
      }
    },
    {
      name: 'ready',
      handler: async (client: any, _: any, context: any) => {
        // Startup initialization
        startAnalysisLoop(client, (gId) => context.getModulesState(gId), context);

        // Periodically verify connections
        const modules = context.getModulesState ? context.getModulesState() : [];
        const vpMod = modules.find((m: any) => m.id === 'voice-protection');
        if (vpMod) {
          const config = { ...DEFAULT_CONFIG, ...(vpMod.config || {}) };
          const guild = client.guilds.cache.get(context.guildId);
          if (guild) {
            await updateVoiceChannelConnection(guild, config, context).catch(() => {});
          }
        }
      }
    }
  ],
  routes: VoiceProtectionRoutes
};

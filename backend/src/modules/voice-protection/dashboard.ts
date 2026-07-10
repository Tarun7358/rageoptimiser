import { getCurrentlyMonitoredUsers } from './analyzer.js';

export const VoiceProtectionRoutes = [
  {
    path: '/state',
    method: 'get' as const,
    handler: async (req: any, res: any, context: any) => {
      const modules = context.getModulesState();
      const vpMod = modules.find((m: any) => m.id === 'voice-protection');

      const guildId = context.guildId;
      const client = context.client;
      const rawMonitored = getCurrentlyMonitoredUsers(guildId);

      const monitoredUsers = [];
      if (client) {
        const guild = client.guilds.cache.get(guildId);
        if (guild) {
          for (const raw of rawMonitored) {
            const member = guild.members.cache.get(raw.userId);
            const channel = guild.channels.cache.get(raw.channelId);
            if (member) {
              monitoredUsers.push({
                userId: raw.userId,
                username: member.user.username,
                avatar: member.user.avatar,
                tag: member.user.tag,
                channelId: raw.channelId,
                channelName: channel ? channel.name : 'Unknown Channel'
              });
            }
          }
        }
      }

      res.json({
        config: vpMod?.config || {},
        monitoredUsers
      });
    }
  }
];

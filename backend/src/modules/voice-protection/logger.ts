import { EmbedBuilder } from 'discord.js';

export async function sendVoiceProtectionLog(
  client: any,
  guildId: string,
  config: any,
  context: any,
  details: {
    user: any;
    channel: any;
    avgLoudness: number;
    peakLoudness: number;
    action: string;
    duration?: number;
  }
) {
  const { user, channel, avgLoudness, peakLoudness, action, duration } = details;

  // 1. Log to the central Security Timeline
  const timelineMessage = `[Voice Protection] Punished user ${user.username} (${action}${duration ? ` for ${duration}s` : ''}) in channel #${channel.name}. Avg Loudness: ${avgLoudness}%, Peak: ${peakLoudness}%`;
  if (context.logSyncEvent) {
    context.logSyncEvent(timelineMessage, action === 'warn' ? 'warn' : 'success');
  }

  // 2. Log to the specific Log Channel configured
  if (!config.logChannel) return;
  try {
    const logChan = await client.channels.fetch(config.logChannel).catch(() => null);
    if (logChan && logChan.isTextBased()) {
      const embed = new EmbedBuilder()
        .setTitle('🎙️ Voice Protection Incident')
        .setDescription(`An audio disturbance (excessive volume/ear-rape) was detected and punished.`)
        .setColor(action === 'warn' ? 0xe67e22 : 0xe74c3c)
        .addFields(
          { name: '👤 User', value: `${user} (${user.username})`, inline: true },
          { name: '🔊 Channel', value: `${channel.name} (<#${channel.id}>)`, inline: true },
          { name: '⚡ Action Taken', value: `**${action.toUpperCase()}**`, inline: true },
          { name: '📊 Avg Loudness', value: `\`${avgLoudness}%\``, inline: true },
          { name: '📈 Peak Loudness', value: `\`${peakLoudness}%\``, inline: true }
        )
        .setTimestamp();

      if (duration) {
        embed.addFields({ name: '⏳ Mute Duration', value: `\`${duration} seconds\``, inline: true });
      }

      await logChan.send({ embeds: [embed] }).catch(() => {});
    }
  } catch (err) {
    console.error('[Voice Protection Log] Error sending log to channel:', err);
  }
}

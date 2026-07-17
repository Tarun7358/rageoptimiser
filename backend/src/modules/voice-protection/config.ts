export interface VoiceProtectionStats {
  totalDetections: number;
  totalMutes: number;
  avgLoudness: number;
  peakLoudness: number;
  mostDetectedUsers: Record<string, { username: string; count: number }>;
  history: Array<{ date: string; detections: number }>;
}

export interface VoiceProtectionConfig {
  enabled: boolean;
  threshold: number;             // RMS loudness threshold (0-100)
  duration: number;              // Continuous duration (seconds) before action
  sampleInterval: number;        // Interval (ms) to check audio buffers (default 150)
  rollingAverageWindow: number;  // Number of sample intervals to average (default 20)
  punishment: 'warn' | 'servermute' | 'tempmute' | 'disconnect' | 'timeout' | 'quarantine' | 'ban' | 'escalate';
  muteDuration: number;          // Mute duration (seconds) for tempmute
  cooldown: number;              // Action cooldown (seconds) per user
  autoUnmute: boolean;           // Auto unmute when tempmute duration expires
  dmNotification: boolean;       // Send DM notification to punished user
  ignoredChannels: string[];     // Array of channel IDs
  ignoredRoles: string[];        // Array of role IDs
  whitelistedUsers: string[];    // Array of user IDs
  whitelistedRoles: string[];    // Array of role IDs
  logChannel: string | null;     // Log channel ID
  stats: VoiceProtectionStats;   // Persistent stats
  activeMutes: Array<{           // Active temp mutes tracking
    userId: string;
    unmuteAt: number;
  }>;
  currentVoiceChannelId: string | null;
  monitoringStatus: 'monitoring' | 'suspended' | 'disabled' | null;
  connectedSince: number | null;
  lastSwitched: number | null;
  switchedBy: string | null;
}

export const DEFAULT_CONFIG: VoiceProtectionConfig = {
  enabled: false,
  threshold: 85,
  duration: 3,
  sampleInterval: 150,
  rollingAverageWindow: 20,
  punishment: 'servermute',
  muteDuration: 30,
  cooldown: 60,
  autoUnmute: true,
  dmNotification: true,
  ignoredChannels: [],
  ignoredRoles: [],
  whitelistedUsers: [],
  whitelistedRoles: [],
  logChannel: null,
  stats: {
    totalDetections: 0,
    totalMutes: 0,
    avgLoudness: 0,
    peakLoudness: 0,
    mostDetectedUsers: {},
    history: []
  },
  activeMutes: [],
  currentVoiceChannelId: null,
  monitoringStatus: null,
  connectedSince: null,
  lastSwitched: null,
  switchedBy: null
};

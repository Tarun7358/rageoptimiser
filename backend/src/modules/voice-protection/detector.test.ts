import { jest } from '@jest/globals';

jest.unstable_mockModule('@discordjs/voice', () => ({
  joinVoiceChannel: jest.fn(),
  getVoiceConnection: jest.fn(),
}));

jest.unstable_mockModule('./analyzer.js', () => ({
  startMonitoringUser: jest.fn(),
  stopMonitoringUser: jest.fn(),
  stopMonitoringAllInGuild: jest.fn(),
}));

jest.unstable_mockModule('./punishment.js', () => ({
  executePunishment: jest.fn(),
  isMemberImmune: jest.fn(),
}));

const { joinVoiceChannel, getVoiceConnection } = await import('@discordjs/voice') as any;
const { executePunishment } = await import('./punishment.js') as any;
const { updateVoiceChannelConnection, handleVoiceStateUpdate } = await import('./detector.js') as any;

class MockCollection extends Map<any, any> {
  constructor(entries?: readonly (readonly [any, any])[] | null) {
    super(entries);
  }
  filter(fn: any) {
    const result = new MockCollection();
    for (const [key, val] of this.entries()) {
      if (fn(val, key)) {
        result.set(key, val);
      }
    }
    return result;
  }
}

describe('Voice Protection - updateVoiceChannelConnection', () => {
  let mockGuild: any;
  let mockContext: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockGuild = {
      id: 'guild123',
      voiceAdapterCreator: {},
      members: {
        me: { id: 'bot123' },
      },
      channels: {
        cache: new MockCollection(),
      },
    };

    mockContext = {
      getModulesState: jest.fn(() => []),
      logSyncEvent: jest.fn(),
    };
  });

  it('should switch channels if the current channel is ignored and another monitored channel has humans', async () => {
    const mockConnection = {
      joinConfig: {
        channelId: 'channel-ignored',
      },
      destroy: jest.fn(),
    };
    (getVoiceConnection as any).mockReturnValue(mockConnection);

    const channelA = {
      id: 'channel-ignored',
      isVoiceBased: () => true,
      members: new MockCollection([
        ['user1', { user: { bot: false }, voice: { serverMute: false } }],
        ['user2', { user: { bot: false }, voice: { serverMute: false } }],
      ]),
    };

    const channelB = {
      id: 'channel-monitored',
      isVoiceBased: () => true,
      name: 'Monitored Channel',
      permissionsFor: () => ({
        has: () => true,
      }),
      members: new MockCollection([
        ['user3', { user: { bot: false }, voice: { serverMute: false } }],
      ]),
    };

    mockGuild.channels.cache.set('channel-ignored', channelA);
    mockGuild.channels.cache.set('channel-monitored', channelB);

    const config = {
      enabled: true,
      ignoredChannels: ['channel-ignored'],
    };

    await updateVoiceChannelConnection(mockGuild, config, mockContext);

    expect(joinVoiceChannel).toHaveBeenCalledWith(
      expect.objectContaining({
        channelId: 'channel-monitored',
        guildId: 'guild123',
      })
    );
  });

  it('should lock to the currentVoiceChannelId if manual override is specified, even if another channel has more humans', async () => {
    const mockConnection = {
      joinConfig: {
        channelId: 'channel-other',
      },
      destroy: jest.fn(),
    };
    (getVoiceConnection as any).mockReturnValue(mockConnection);

    const channelOther = {
      id: 'channel-other',
      isVoiceBased: () => true,
      name: 'Other Channel',
      members: new MockCollection([
        ['user1', { user: { bot: false }, voice: { serverMute: false } }],
        ['user2', { user: { bot: false }, voice: { serverMute: false } }],
        ['user3', { user: { bot: false }, voice: { serverMute: false } }],
      ]),
    };

    const channelOverride = {
      id: 'channel-target',
      isVoiceBased: () => true,
      name: 'Target Channel',
      permissionsFor: () => ({
        has: () => true,
      }),
      members: new MockCollection([
        ['user4', { user: { bot: false }, voice: { serverMute: false } }],
      ]),
    };

    mockGuild.channels.cache.set('channel-other', channelOther);
    mockGuild.channels.cache.set('channel-target', channelOverride);

    const config = {
      enabled: true,
      currentVoiceChannelId: 'channel-target',
    };

    await updateVoiceChannelConnection(mockGuild, config, mockContext);

    expect(joinVoiceChannel).toHaveBeenCalledWith(
      expect.objectContaining({
        channelId: 'channel-target',
        guildId: 'guild123',
      })
    );
  });
});

describe('Voice Protection - handleVoiceStateUpdate Abuse Detection', () => {
  let mockClient: any;
  let mockContext: any;
  let config: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = {};
    mockContext = {
      getModulesState: jest.fn(() => []),
      logSyncEvent: jest.fn(),
    };
    config = {
      enabled: true,
    };
  });

  it('should detect voice channel hopping and execute punishment', async () => {
    const oldState = {
      id: 'user_abuser',
      channelId: 'channel1',
      guild: { id: 'guild123', channels: { cache: new MockCollection() } },
    };

    const newState = {
      id: 'user_abuser',
      channelId: 'channel2',
      guild: { id: 'guild123', channels: { cache: new MockCollection() } },
      member: { user: { bot: false } },
    };

    // Simulate 4 rapid joins
    for (let i = 0; i < 4; i++) {
      newState.channelId = `channel_new_${i}`;
      await handleVoiceStateUpdate(mockClient, oldState, newState, config, mockContext);
    }

    expect(executePunishment).toHaveBeenCalledWith(
      mockClient,
      'guild123',
      'user_abuser',
      expect.any(String),
      99,
      100,
      config,
      mockContext,
      'Voice Channel Hopping'
    );
  });

  it('should detect rapid mute toggling and execute punishment', async () => {
    const oldState = {
      id: 'user_spammer',
      selfMute: false,
      guild: { id: 'guild123', channels: { cache: new MockCollection() } },
    };

    const newState = {
      id: 'user_spammer',
      selfMute: true,
      guild: { id: 'guild123', channels: { cache: new MockCollection() } },
      member: { user: { bot: false } },
    };

    // Simulate 6 mute changes
    for (let i = 0; i < 6; i++) {
      newState.selfMute = !oldState.selfMute;
      await handleVoiceStateUpdate(mockClient, oldState, newState, config, mockContext);
    }

    expect(executePunishment).toHaveBeenCalledWith(
      mockClient,
      'guild123',
      'user_spammer',
      expect.any(String),
      99,
      100,
      config,
      mockContext,
      'Rapid Mute Toggle Spam'
    );
  });
});

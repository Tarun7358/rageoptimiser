import { JoinToCreateManifest } from './manifest.js';
import { ChannelType } from 'discord.js';
import { jest } from '@jest/globals';

describe('JoinToCreate - Sync with Category feature', () => {
  let mockClient: any;
  let mockContext: any;
  let mockGuild: any;
  let mockNewChannel: any;
  let mockTriggerChannel: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockTriggerChannel = {
      id: 'trigger_voice_channel',
      parentId: 'category_123',
    };

    mockNewChannel = {
      id: 'new_temp_voice_channel',
      lockPermissions: jest.fn().mockImplementation(() => Promise.resolve()),
      permissionOverwrites: {
        edit: jest.fn().mockImplementation(() => Promise.resolve()),
      },
    };

    mockGuild = {
      id: 'guild_123',
      channels: {
        cache: {
          get: jest.fn((id: string) => {
            if (id === 'trigger_voice_channel') return mockTriggerChannel;
            if (id === 'category_123') {
              return {
                id: 'category_123',
                permissionOverwrites: {
                  cache: [
                    {
                      id: 'role_everyone',
                      type: 0,
                      allow: 0,
                      deny: 1048576 // Connect denied
                    }
                  ]
                }
              };
            }
            return null;
          }),
        },
        create: jest.fn().mockImplementation(() => Promise.resolve(mockNewChannel)),
        fetch: jest.fn().mockImplementation(() => Promise.resolve(null)),
      },
    };

    mockClient = {};
    mockContext = {
      getModulesState: jest.fn(() => [
        {
          id: 'join_to_create',
          status: 'enabled',
          config: {
            triggers: [
              {
                id: 'trigger_1',
                label: 'Gaming',
                triggerChannelId: 'trigger_voice_channel',
                categoryId: 'category_123',
                defaultName: "{username}'s Lounge",
                defaultLimit: 4,
                privacy: 'sync', // Sync with Category
              },
            ],
            activeChannels: [],
          },
        },
      ]),
      updateModuleConfig: jest.fn().mockImplementation(() => Promise.resolve()),
      logSyncEvent: jest.fn(),
    };
  });

  it('should call lockPermissions and set user overrides when privacy is "sync"', async () => {
    const vsuEvent = JoinToCreateManifest.events?.find(e => e.name === 'voiceStateUpdate');
    expect(vsuEvent).toBeDefined();

    const oldState = {
      channelId: null,
      guild: mockGuild,
    };

    const newState = {
      channelId: 'trigger_voice_channel',
      guild: mockGuild,
      member: {
        id: 'member_user_abc',
        user: { username: 'testuser' },
        displayName: 'TestUserDisplay',
        voice: {
          setChannel: jest.fn().mockImplementation(() => Promise.resolve()),
        },
      },
    };

    await vsuEvent?.handler(mockClient, { oldState, newState }, mockContext);

    // Verify channel was created with category and owner overrides
    expect(mockGuild.channels.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "testuser's Lounge",
        type: ChannelType.GuildVoice,
        parent: 'category_123',
        userLimit: 4,
        permissionOverwrites: expect.arrayContaining([
          expect.objectContaining({
            id: 'role_everyone',
            deny: 1048576
          }),
          expect.objectContaining({
            id: 'member_user_abc',
            allow: expect.any(Array)
          })
        ])
      })
    );

    // Verify lockPermissions was called since privacy is "sync"
    expect(mockNewChannel.lockPermissions).toHaveBeenCalled();

    // Verify permission overrides edit was called for the creator
    expect(mockNewChannel.permissionOverwrites.edit).toHaveBeenCalledWith(
      'member_user_abc',
      expect.objectContaining({
        ManageChannels: true,
        Connect: true,
        ViewChannel: true,
        Speak: true,
      })
    );
  });

  it('should not splice channel from activeChannels on fetch rate limit error, but should splice it on 10003 Unknown Channel error', async () => {
    const vsuEvent = JoinToCreateManifest.events?.find(e => e.name === 'voiceStateUpdate');
    expect(vsuEvent).toBeDefined();

    const activeChannels = [
      {
        channelId: 'channel_rate_limited',
        ownerId: 'owner_1',
        ownerTag: 'user_1',
        name: 'Channel 1',
        locked: false,
        limit: 0,
        triggerId: 'trigger_1',
        createdAt: new Date()
      },
      {
        channelId: 'channel_deleted',
        ownerId: 'owner_2',
        ownerTag: 'user_2',
        name: 'Channel 2',
        locked: false,
        limit: 0,
        triggerId: 'trigger_1',
        createdAt: new Date()
      }
    ];

    mockContext.getModulesState.mockReturnValue([
      {
        id: 'join_to_create',
        status: 'enabled',
        config: {
          triggers: [{ id: 'trigger_1', triggerChannelId: 'some_trigger' }],
          activeChannels
        }
      }
    ]);

    mockGuild.channels.cache.get.mockReturnValue(null); // Force fetch
    
    mockGuild.channels.fetch = jest.fn().mockImplementation((id: any) => {
      if (id === 'channel_rate_limited') {
        const err: any = new Error('Rate Limited');
        err.code = 50035;
        return Promise.reject(err);
      }
      if (id === 'channel_deleted') {
        const err: any = new Error('Unknown Channel');
        err.code = 10003;
        return Promise.reject(err);
      }
      return Promise.resolve(null);
    });

    const oldState = { channelId: null, guild: mockGuild };
    const newState = { channelId: null, guild: mockGuild };

    await vsuEvent?.handler(mockClient, { oldState, newState }, mockContext);

    expect(mockContext.updateModuleConfig).toHaveBeenCalledWith(
      'join_to_create',
      expect.objectContaining({
        activeChannels: expect.arrayContaining([
          expect.objectContaining({ channelId: 'channel_rate_limited' })
        ])
      })
    );

    const callArgs = mockContext.updateModuleConfig.mock.calls[0];
    const updatedActive = callArgs[1].activeChannels;
    expect(updatedActive.length).toBe(1);
    expect(updatedActive[0].channelId).toBe('channel_rate_limited');
  });
});

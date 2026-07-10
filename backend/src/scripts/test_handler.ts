import dotenv from 'dotenv';
import { SecurityManifest } from '../modules/security/manifest.js';
import { PermissionFlagsBits } from 'discord.js';

dotenv.config();

class MockCollection<K = any, V = any> extends Map<K, V> {
  filter(fn: any) {
    const res = new MockCollection();
    for (const [key, val] of this.entries()) {
      if (fn(val, key)) {
        res.set(key, val);
      }
    }
    return res;
  }
  some(fn: any) {
    for (const [key, val] of this.entries()) {
      if (fn(val, key)) return true;
    }
    return false;
  }
  map(fn: any) {
    const res = [];
    for (const [key, val] of this.entries()) {
      res.push(fn(val, key));
    }
    return res;
  }
}

// Helper to mock a GuildMember
function mockMember(id: string, tag: string, rolesList: any[] = []) {
  const rolesCache = new MockCollection(rolesList.map(r => [r.id, r]));
  return {
    id,
    user: { id, tag, username: tag },
    roles: {
      cache: rolesCache,
      remove: async (roleId: string) => {
        console.log(`[Mock Member ${tag}] Removed role: ${roleId}`);
      },
      set: async (roles: any[]) => {
        console.log(`[Mock Member ${tag}] Set roles to:`, roles);
      }
    }
  };
}

async function run() {
  const handler = SecurityManifest.events?.find(e => e.name === 'guildMemberUpdate')?.handler;
  if (!handler) {
    console.error('guildMemberUpdate handler not found in SecurityManifest');
    return;
  }

  console.log('Testing guildMemberUpdate handler...');

  const client = {
    user: { id: 'bot_user_id' }
  };

  const adminRole = {
    id: 'admin_role_id',
    name: 'Administrator',
    permissions: {
      has: (perm: any) => perm === PermissionFlagsBits.Administrator
    }
  };

  // Target member before and after roles change
  const oldMember = mockMember('target_user_id', 'target_tag');
  const newMember = mockMember('target_user_id', 'target_tag', [adminRole]);
  (newMember as any).guild = {
    id: '1524869545590915262',
    name: 'Clutch Guild',
    ownerId: 'owner_user_id',
    channels: {
      cache: new MockCollection()
    },
    roles: {
      cache: new MockCollection([['admin_role_id', adminRole]])
    },
    client: {
      application: {
        owner: { id: 'app_owner_id' }
      }
    },
    members: {
      cache: new MockCollection(),
      fetch: async (id: string) => {
        // Return executor member
        return mockMember(id, 'rbzclasher', [adminRole]);
      }
    },
    fetchAuditLogs: async () => {
      return {
        entries: [
          {
            targetId: 'target_user_id',
            createdTimestamp: Date.now(),
            executor: {
              id: '1140892126402596905', // rbzclasher
              tag: 'rbzclasher#0'
            }
          }
        ]
      };
    }
  };

  const context = {
    getModulesState: () => [
      {
        id: 'security',
        status: 'enabled',
        config: {
          rules: {
            anti_member_update: { enabled: true, limit: 3, window: 10, action: 'quarantine', recovery: true }
          }
        }
      },
      {
        id: 'member_whitelist',
        status: 'enabled',
        config: {
          members: [
            {
              id: '1140892126402596905',
              userId: '1140892126402596905',
              tag: 'rbzclasher',
              status: 'active',
              enabledModules: [
                'anti_member_update'
              ]
            }
          ]
        }
      }
    ],
    logSyncEvent: (guildId: string, msg: string, type: string) => {
      console.log(`[logSyncEvent] [${type.toUpperCase()}] ${guildId}: ${msg}`);
    },
    updateModuleConfig: (moduleId: string, config: any) => {
      console.log(`[updateModuleConfig] Updated config for ${moduleId}`);
    }
  };

  console.log('\n--- Case 1: Whitelisted user rbzclasher with anti_member_update ---\n');
  await handler(client, oldMember, newMember, context);

  console.log('\n--- Case 2: Whitelisted user rbzclasher WITHOUT anti_member_update (has anti_role_grant only) ---\n');
  const contextNoBypass = {
    ...context,
    getModulesState: () => [
      {
        id: 'security',
        status: 'enabled',
        config: {
          rules: {
            anti_member_update: { enabled: true, limit: 3, window: 10, action: 'quarantine', recovery: true }
          }
        }
      },
      {
        id: 'member_whitelist',
        status: 'enabled',
        config: {
          members: [
            {
              id: '1140892126402596905',
              userId: '1140892126402596905',
              tag: 'rbzclasher',
              status: 'active',
              enabledModules: [
                'anti_role_grant' // Has role grant but not member update
              ]
            }
          ]
        }
      }
    ]
  };
  await handler(client, oldMember, newMember, contextNoBypass);

  console.log('\n--- Case 3: Non-whitelisted user rbzclasher (no whitelist entry) ---\n');
  const contextNoWhitelist = {
    ...context,
    getModulesState: () => [
      {
        id: 'security',
        status: 'enabled',
        config: {
          rules: {
            anti_role_grant: { enabled: true, limit: 3, window: 10, action: 'quarantine', recovery: true }
          }
        }
      },
      {
        id: 'member_whitelist',
        status: 'enabled',
        config: {
          members: [] // No entries
        }
      }
    ]
  };
  console.log('Call 1:');
  await handler(client, oldMember, newMember, contextNoWhitelist);
  console.log('Call 2:');
  await handler(client, oldMember, newMember, contextNoWhitelist);
  console.log('Call 3:');
  await handler(client, oldMember, newMember, contextNoWhitelist);
}

run().catch(console.error);

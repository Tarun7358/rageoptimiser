export const protections = [
  { key: 'anti_ban', label: 'Anti Ban' },
  { key: 'anti_unban', label: 'Anti Unban' },
  { key: 'anti_kick', label: 'Anti Kick' },
  { key: 'anti_prune', label: 'Anti Member Prune' },
  { key: 'anti_bot_add', label: 'Anti Bot Add' },
  { key: 'anti_channel_create', label: 'Anti Channel Create' },
  { key: 'anti_channel_delete', label: 'Anti Channel Delete' },
  { key: 'anti_channel_update', label: 'Anti Channel Update' },
  { key: 'anti_role_create', label: 'Anti Role Create' },
  { key: 'anti_role_delete', label: 'Anti Role Delete' },
  { key: 'anti_role_update', label: 'Anti Role Update' },
  { key: 'anti_role_grant', label: 'Anti Role Assign' },
  { key: 'anti_role_remove', label: 'Anti Role Remove' },
  { key: 'anti_member_update', label: 'Anti Member Update' },
  { key: 'anti_emoji_create', label: 'Anti Emoji/Sticker Create' },
  { key: 'anti_emoji_delete', label: 'Anti Emoji/Sticker Delete' },
  { key: 'anti_emoji_update', label: 'Anti Emoji/Sticker Update' },
  { key: 'anti_everyone_ping', label: 'Anti Everyone/Here Ping' },
  { key: 'anti_role_ping', label: 'Anti Role Ping' },
  { key: 'anti_integration', label: 'Anti Integration' },
  { key: 'anti_guild_update', label: 'Anti Guild Update' },
  { key: 'anti_webhook_create', label: 'Anti Webhook Create' },
  { key: 'anti_webhook_delete', label: 'Anti Webhook Delete' },
  { key: 'anti_webhook_update', label: 'Anti Webhook Update' }
];

export async function checkWhitelistPermission(userId: string, guild: any, context: any): Promise<boolean> {
  if (!guild) return false;

  // 1. Guild owner always has permission (per-guild — no global OWNER_ID override)
  if (userId === guild.ownerId || 
      userId === guild.client.application?.owner?.id ||
      ((guild.client.application?.owner as any)?.members && (guild.client.application?.owner as any).members.has(userId))) return true;

  const modules = context.getModulesState ? context.getModulesState() : [];

  // 2. Check member_whitelist
  const mwModule = modules.find((m: any) => m.id === 'member_whitelist');
  const members = mwModule?.config?.members || [];
  const isWhitelistedMember = members.some((m: any) => m.userId === userId && m.status === 'active');
  if (isWhitelistedMember) return true;

  // 3. Check security whitelist
  const secModule = modules.find((m: any) => m.id === 'security');
  const secConfig = secModule?.config || {};
  const secWhitelist = secConfig.whitelist || [];
  const isSecWhitelisted = secWhitelist.some((w: any) => {
    if (!w) return false;
    if (typeof w === 'string') return w === userId;
    return w.targetId === userId;
  });
  if (isSecWhitelisted) return true;

  return false;
}

export async function checkBypassImmunity(
  userId: string,
  guild: any,
  context: any,
  ruleId?: string
): Promise<boolean> {
  if (!guild) {
    console.log('[checkBypassImmunity] No guild provided');
    return false;
  }

  console.log(`[checkBypassImmunity] Checking userId=${userId}, ruleId=${ruleId}, guildId=${guild.id}`);

  // 1. Guild owner always bypasses
  if (userId === guild.ownerId || 
      userId === guild.client.application?.owner?.id ||
      ((guild.client.application?.owner as any)?.members && (guild.client.application?.owner as any).members.has(userId))) {
    console.log(`[checkBypassImmunity] Bypassed: Owner match for ${userId}`);
    return true;
  }

  // 2. Sibling Music Bot always bypasses
  if (process.env.MUSIC_CLIENT_ID && userId === process.env.MUSIC_CLIENT_ID) {
    console.log(`[checkBypassImmunity] Bypassed: Sibling Music Bot match for ${userId}`);
    return true;
  }

  const modules = context.getModulesState ? context.getModulesState() : [];
  console.log(`[checkBypassImmunity] Loaded ${modules.length} modules from context state.`);

  // Helper to check rule-specific modules
  const isBypassedForRule = (enabledModules: string[]) => {
    if (!ruleId) {
      console.log('[checkBypassImmunity] No ruleId specified, bypassing by default');
      return true;
    }
    // Default to bypassing everything if whitelist entry does not specify specific modules
    if (!enabledModules || enabledModules.length === 0) {
      console.log(`[checkBypassImmunity] enabledModules is empty, bypassing ${ruleId} by default`);
      return true;
    }
    if (enabledModules.includes(ruleId)) {
      console.log(`[checkBypassImmunity] Match: enabledModules includes ${ruleId}`);
      return true;
    }
    if (enabledModules.some((m: string) => m.toLowerCase() === 'all' || m.toLowerCase() === 'any')) {
      console.log('[checkBypassImmunity] Match: enabledModules includes ALL/ANY');
      return true;
    }
    if (ruleId.startsWith('anti_') && (enabledModules.includes('Anti-Nuke') || enabledModules.includes('anti_nuke') || enabledModules.includes('anti-nuke'))) {
      console.log(`[checkBypassImmunity] Match: ruleId starts with anti_ and enabledModules has Anti-Nuke`);
      return true;
    }
    if (ruleId === 'voice_protection' && (enabledModules.includes('voice-protection') || enabledModules.includes('voice_protection') || enabledModules.includes('Voice-Protection'))) {
      console.log(`[checkBypassImmunity] Match: ruleId is voice_protection and enabledModules has voice-protection`);
      return true;
    }
    console.log(`[checkBypassImmunity] No match for ruleId ${ruleId} in enabledModules:`, enabledModules);
    return false;
  };

  // 3. Unified Whitelist check (from member_whitelist.config.members)
  const mwModule = modules.find((m: any) => m.id === 'member_whitelist');
  const whitelistEntries = mwModule?.config?.members || [];
  console.log(`[checkBypassImmunity] member_whitelist config has ${whitelistEntries.length} entries.`);

  // 3a. User Check (Member or Bot in unified whitelist)
  const userRecord = whitelistEntries.find((m: any) => m.userId === userId && m.status === 'active');
  if (userRecord) {
    console.log(`[checkBypassImmunity] Found user whitelist record for ${userId}. enabledModules:`, userRecord.enabledModules);
    if (isBypassedForRule(userRecord.enabledModules || [])) {
      console.log(`[checkBypassImmunity] Bypassed: User record rule bypass for ${userId}`);
      return true;
    }
  }

  // Fetch member for role and local config checks
  const member = guild.members.cache.get(userId) || await guild.members.fetch(userId).catch(() => null);

  // 3b. Role Check (Role in unified whitelist)
  if (member) {
    const roleEntries = whitelistEntries.filter((m: any) => (m.type === 'role' || m.roleId) && m.status === 'active');
    for (const roleRecord of roleEntries) {
      const roleId = roleRecord.roleId || roleRecord.id;
      if (roleId && member.roles.cache.has(roleId)) {
        if (isBypassedForRule(roleRecord.enabledModules || [])) return true;
      }
    }
  }

  // 4. Fallback bot_whitelist check
  const bwModule = modules.find((m: any) => m.id === 'bot_whitelist');
  const bots = bwModule?.config?.bots || [];
  const botRecord = bots.find((b: any) => b.userId === userId && b.status === 'active');
  if (botRecord) {
    if (isBypassedForRule(botRecord.enabledModules || [])) return true;
  }

  // 5. Fallback role_whitelist check
  const rwModule = modules.find((m: any) => m.id === 'role_whitelist');
  const roles = rwModule?.config?.roles || [];
  const activeRoles = roles.filter((r: any) => r.status === 'active');
  if (activeRoles.length > 0 && member) {
    for (const roleRecord of activeRoles) {
      if (member.roles.cache.has(roleRecord.roleId)) {
        if (isBypassedForRule(roleRecord.enabledModules || [])) return true;
      }
    }
  }

  // 6. Fallback security module whitelist config
  const secModule = modules.find((m: any) => m.id === 'security');
  const secConfig = secModule?.config || {};
  const upm = secConfig.upm || {};

  // 6a. User whitelist (general security whitelist)
  const secWhitelist = secConfig.whitelist || [];
  if (secWhitelist.some((w: any) => {
    if (!w) return false;
    if (typeof w === 'string') return w === userId;
    return w.targetId === userId;
  })) return true;

  // 6b. Exception roles (general security whitelist roles)
  const exceptionRoleIds: string[] = secConfig.exceptionRoleIds || secConfig.whitelistRoles || [];
  if (exceptionRoleIds.length > 0 && member) {
    if (member.roles.cache.some((r: any) => exceptionRoleIds.includes(r.id))) return true;
  }

  // 6c. UPM Whitelisted Users
  const upmWhitelistUsers: string[] = upm.whitelistUsers || [];
  if (upmWhitelistUsers.includes(userId)) return true;

  // 6d. UPM Whitelisted Roles & Ignored Roles
  const upmWhitelistRoles: string[] = upm.whitelistRoles || [];
  const upmIgnoredRoles: string[] = upm.ignoredRoles || [];
  if (member) {
    if (upmWhitelistRoles.length > 0 && member.roles.cache.some((r: any) => upmWhitelistRoles.includes(r.id))) return true;
    if (upmIgnoredRoles.length > 0 && member.roles.cache.some((r: any) => upmIgnoredRoles.includes(r.id))) return true;
  }

  // 7. Fallback voice protection module whitelist
  if (ruleId === 'voice_protection' || ruleId?.startsWith('voice_')) {
    const vpModule = modules.find((m: any) => m.id === 'voice-protection');
    const vpConfig = vpModule?.config || {};

    // User whitelist
    if (vpConfig.whitelistedUsers?.includes(userId)) return true;

    // Role whitelist
    if (vpConfig.whitelistedRoles?.length > 0 && member) {
      if (vpConfig.whitelistedRoles.some((rId: string) => member.roles.cache.has(rId))) return true;
    }
  }

  return false;
}

export function migrateToUnifiedWhitelist(context: any) {
  const modules = context.getModulesState ? context.getModulesState() : [];
  const mwModule = modules.find((m: any) => m.id === 'member_whitelist');
  if (!mwModule) return;

  const bwModule = modules.find((m: any) => m.id === 'bot_whitelist');
  const rwModule = modules.find((m: any) => m.id === 'role_whitelist');
  const secModule = modules.find((m: any) => m.id === 'security');
  const vpModule = modules.find((m: any) => m.id === 'voice-protection');

  let unified = [...(mwModule.config?.members || [])];
  let changed = false;

  const allBypasses = [...protections.map(p => p.key), 'voice_protection'];

  // Helper to add unique entries
  const addEntry = (id: string, record: any) => {
    if (!unified.some((e: any) => e.userId === id || e.roleId === id || e.id === id)) {
      unified.push(record);
      changed = true;
    }
  };

  // 1. Migrate bots
  const bots = bwModule?.config?.bots || [];
  for (const bot of bots) {
    addEntry(bot.userId, {
      id: bot.userId,
      userId: bot.userId,
      tag: bot.tag || `Bot-${bot.userId}`,
      status: bot.status || 'active',
      type: 'bot',
      enabledModules: bot.enabledModules || allBypasses,
      managedRoleId: bot.managedRoleId,
      autoConfigure: bot.autoConfigure !== false,
      autoRestore: bot.autoRestore !== false,
      notes: bot.notes || 'Migrated from Bot Whitelist',
      createdDate: bot.createdDate || new Date().toISOString()
    });
  }

  // 2. Migrate roles
  const roles = rwModule?.config?.roles || [];
  for (const role of roles) {
    addEntry(role.roleId, {
      id: role.roleId,
      roleId: role.roleId,
      name: role.name || `Role-${role.roleId}`,
      status: role.status || 'active',
      type: 'role',
      enabledModules: role.enabledModules || allBypasses,
      createdDate: role.createdDate || new Date().toISOString()
    });
  }

  // 3. Migrate security whitelist
  const secWhitelist = secModule?.config?.whitelist || [];
  for (const w of secWhitelist) {
    const userId = typeof w === 'string' ? w : w.targetId;
    const tag = typeof w === 'string' ? `User-${w}` : w.tag || `User-${w}`;
    if (userId) {
      addEntry(userId, {
        id: userId,
        userId: userId,
        tag: tag,
        status: 'active',
        type: 'member',
        enabledModules: allBypasses,
        notes: 'Migrated from Security Whitelist',
        createdDate: typeof w === 'string' ? new Date().toISOString() : w.addedAt || new Date().toISOString()
      });
    }
  }

  // 4. Migrate security exception roles
  const secRoles = secModule?.config?.exceptionRoleIds || secModule?.config?.whitelistRoles || [];
  for (const rId of secRoles) {
    addEntry(rId, {
      id: rId,
      roleId: rId,
      name: `Role-${rId}`,
      status: 'active',
      type: 'role',
      enabledModules: allBypasses,
      notes: 'Migrated from Security Roles',
      createdDate: new Date().toISOString()
    });
  }

  // 5. Migrate UPM whitelist users
  const upmUsers = secModule?.config?.upm?.whitelistUsers || [];
  for (const uId of upmUsers) {
    addEntry(uId, {
      id: uId,
      userId: uId,
      tag: `User-${uId}`,
      status: 'active',
      type: 'member',
      enabledModules: allBypasses,
      notes: 'Migrated from UPM Whitelist Users',
      createdDate: new Date().toISOString()
    });
  }

  // 6. Migrate UPM whitelist roles
  const upmRoles = secModule?.config?.upm?.whitelistRoles || [];
  for (const rId of upmRoles) {
    addEntry(rId, {
      id: rId,
      roleId: rId,
      name: `Role-${rId}`,
      status: 'active',
      type: 'role',
      enabledModules: allBypasses,
      notes: 'Migrated from UPM Whitelist Roles',
      createdDate: new Date().toISOString()
    });
  }

  // 7. Migrate voice protection whitelist users
  const vpUsers = vpModule?.config?.whitelistedUsers || [];
  for (const uId of vpUsers) {
    addEntry(uId, {
      id: uId,
      userId: uId,
      tag: `User-${uId}`,
      status: 'active',
      type: 'member',
      enabledModules: allBypasses,
      notes: 'Migrated from Voice Whitelist Users',
      createdDate: new Date().toISOString()
    });
  }

  // 8. Migrate voice protection whitelist roles
  const vpRoles = vpModule?.config?.whitelistedRoles || [];
  for (const rId of vpRoles) {
    addEntry(rId, {
      id: rId,
      roleId: rId,
      name: `Role-${rId}`,
      status: 'active',
      type: 'role',
      enabledModules: allBypasses,
      notes: 'Migrated from Voice Whitelist Roles',
      createdDate: new Date().toISOString()
    });
  }

  if (changed) {
    context.updateModuleConfig('member_whitelist', { members: unified });
    context.logSyncEvent(`Migrated ${unified.length} legacy entries to the Unified Whitelist.`, 'success');
  }
}


export async function getGuildAndCheckPermission(userOrId: string | any, context: any): Promise<boolean> {
  let userId = '';
  let userObj: any = null;

  if (userOrId && typeof userOrId === 'object') {
    userId = userOrId.id;
    userObj = userOrId;
  } else {
    userId = userOrId;
  }

  const guildId = context.guildId;

  // Fast path: JWT managedGuildIds are already verified at OAuth time (user has Manage Server or is owner)
  // Use this as the primary check — no Discord API round-trip required.
  if (userObj) {
    if (Array.isArray(userObj.managedGuildIds) && userObj.managedGuildIds.includes(guildId)) return true;
    if (userObj.role === 'owner') return true;
  }

  // Secondary: Try to fetch guild from Discord for deeper owner/whitelist check
  if (!context.client || !guildId) {
    // No Discord client available — fall back to JWT role check
    return userObj?.role === 'owner';
  }

  const guild = await context.client.guilds.fetch(guildId).catch(() => null);
  if (!guild) {
    // Guild not reachable — trust JWT managedGuildIds as fallback
    if (userObj) {
      const mgIds: string[] = userObj.managedGuildIds || [];
      if (mgIds.includes(guildId) || userObj.role === 'owner') return true;
    }
    return false;
  }

  return checkWhitelistPermission(userId, guild, context);
}

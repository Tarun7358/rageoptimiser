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

  // 1. Guild owner always has permission (with OWNER_ID fallback)
  if (userId === guild.ownerId || userId === process.env.OWNER_ID) return true;

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

export async function getGuildAndCheckPermission(userOrId: string | any, context: any): Promise<boolean> {
  if (userOrId && typeof userOrId === 'object') {
    return getGuildAndCheckPermission(userOrId.id, context);
  }

  const userId = userOrId;
  if (!context.client || !context.guildId) return false;
  const guild = await context.client.guilds.fetch(context.guildId).catch(() => null);
  if (!guild) return false;
  return checkWhitelistPermission(userId, guild, context);
}

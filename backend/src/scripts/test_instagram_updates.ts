import dotenv from 'dotenv';
dotenv.config();

const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJkaXNjb3JkSWQiOiI4MzA5OTMxMjYzMDE2MzA0ODUiLCJ1c2VybmFtZSI6Ind0LnZvaWQiLCJyb2xlIjoiZ3VpbGRfbWFuYWdlciIsIm1hbmFnZWRHdWlsZElkcyI6WyI5NTc0OTM4NDExMzk3NDA2OTIiLCIxNTAwNDg3NDE5NDYyNTUzNzYwIiwiMTUwNzY3MTE1MjM4OTEyODI3MiIsIjE1MDgzOTkxNjE3OTg4MTk4NDAiLCIxNTE3NzgwNDA5OTg1Nzk0MTM4IiwiMTUyNDM0MzIyNDYwNzQ0MDkyNiIsIjE1MjQ4Njk1NDU1OTA5MTUyNjIiXSwiaWF0IjoxNzg0Mjk4NzA0LCJleHAiOjE3ODQ5MDM1MDR9.T6an1rb5wnV0KLfW-m_T5nbIkIZi7ZboW1NG67uo_Es';
const GUILD_ID = '1507671152389128272'; // Rage Optimizer Server
const BASE_URL = 'http://localhost:5000';

async function run() {
  console.log('1. Fetching server state (channels and roles)...');
  const stateRes = await fetch(`${BASE_URL}/api/state`, {
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'X-Guild-Id': GUILD_ID
    }
  });

  if (!stateRes.ok) {
    throw new Error(`Failed to fetch state: ${stateRes.status} ${await stateRes.text()}`);
  }

  const stateData = await stateRes.json();
  const textChannels = (stateData.registry?.channels || []).filter((c: any) => c.type === 0 || c.type === 'text');
  console.log(`Found ${textChannels.length} text channels.`);
  if (textChannels.length === 0) {
    throw new Error('No text channels found in registry to subscribe to.');
  }
  
  const targetChannel = textChannels[0];
  console.log(`Targeting channel: #${targetChannel.name} (${targetChannel.id})`);

  console.log('\n2. Validating Instagram profile "nasa"...');
  const valRes = await fetch(`${BASE_URL}/api/modules/social_updates/validate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      'X-Guild-Id': GUILD_ID
    },
    body: JSON.stringify({ provider: 'instagram', input: 'nasa' })
  });

  const valData = await valRes.json();
  console.log('Validation Response:', JSON.stringify(valData, null, 2));

  if (!valData.valid) {
    throw new Error(`Instagram validation failed: ${valData.error}`);
  }

  // Fetch status and unsubscribe from existing "nasa" subscription if it exists
  console.log('\nChecking for existing "nasa" subscription...');
  const statusRes = await fetch(`${BASE_URL}/api/modules/social_updates/status`, {
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'X-Guild-Id': GUILD_ID
    }
  });
  if (statusRes.ok) {
    const statusData = await statusRes.json();
    const existing = (statusData.subscriptions || []).find(
      (s: any) => s.provider === 'instagram' && s.sourceId === valData.sourceId
    );
    if (existing) {
      console.log(`Found existing subscription for "@nasa" (ID: ${existing.id}). Unsubscribing first...`);
      const unsubRes = await fetch(`${BASE_URL}/api/modules/social_updates/unsubscribe`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${TOKEN}`,
          'Content-Type': 'application/json',
          'X-Guild-Id': GUILD_ID
        },
        body: JSON.stringify({ id: existing.id })
      });
      if (unsubRes.ok) {
        console.log('Successfully unsubscribed existing subscription.');
      } else {
        console.warn(`Unsubscribe failed: ${unsubRes.status} ${await unsubRes.text()}`);
      }
    } else {
      console.log('No existing subscription found for "@nasa".');
    }
  }

  console.log('\n3. Creating Instagram subscription for "@nasa"...');
  const subRes = await fetch(`${BASE_URL}/api/modules/social_updates/subscribe`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      'X-Guild-Id': GUILD_ID
    },
    body: JSON.stringify({
      provider: 'instagram',
      sourceId: valData.sourceId,
      sourceName: valData.sourceName,
      sourceAvatar: valData.sourceAvatar,
      discordChannelId: targetChannel.id,
      embedConfig: {
        color: '#EC4899',
        authorEnabled: true,
        authorName: '@{profile.username}',
        authorIcon: '{profile.avatar}',
        authorUrl: '{profile.url}',
        titleEnabled: true,
        title: '📸 New Post by @{profile.username}',
        titleUrl: '{post.url}',
        descriptionEnabled: true,
        description: '{post.caption}',
        thumbnailEnabled: false,
        imageEnabled: true,
        image: '{post.image}',
        fields: [],
        footerEnabled: true,
        footerText: 'Instagram Alert',
        timestampEnabled: true,
        buttons: [{ label: 'View Post', url: '{post.url}' }],
        mentionRoles: []
      },
      mentionRoles: [],
      pollingMode: 'fast',
      contentTypes: { posts: true, reels: true, stories: false }
    })
  });

  console.log('Subscription response status:', subRes.status);
  const subData = await subRes.json();
  console.log('Subscription response body:', JSON.stringify(subData, null, 2));

  if (!subRes.ok && subRes.status !== 409) {
    throw new Error(`Failed to subscribe: ${JSON.stringify(subData)}`);
  }

  const subId = subData.subscription?.id || 'existing_sub_id';
  console.log(`\n4. Subscription setup completed. Triggering manual test alert for sub: ${subId}...`);
  const testRes = await fetch(`${BASE_URL}/api/modules/social_updates/test`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      'X-Guild-Id': GUILD_ID
    },
    body: JSON.stringify({ id: subId })
  });

  const testData = await testRes.json();
  console.log('Test Notification Response:', JSON.stringify(testData, null, 2));

  console.log('\nInstagram Updates end-to-end check finished successfully!');
}

run().catch(console.error);

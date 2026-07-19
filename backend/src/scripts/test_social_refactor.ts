import dotenv from 'dotenv';
dotenv.config();

const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJkaXNjb3JkSWQiOiI4MzA5OTMxMjYzMDE2MzA0ODUiLCJ1c2VybmFtZSI6Ind0LnZvaWQiLCJyb2xlIjoiZ3VpbGRfbWFuYWdlciIsIm1hbmFnZWRHdWlsZElkcyI6WyI5NTc0OTM4NDExMzk3NDA2OTIiLCIxNTAwNDg3NDE5NDYyNTUzNzYwIiwiMTUwNzY3MTE1MjM4OTEyODI3MiIsIjE1MDgzOTkxNjE3OTg4MTk4NDAiLCIxNTE3NzgwNDA5OTg1Nzk0MTM4IiwiMTUyNDM0MzIyNDYwNzQ0MDkyNiIsIjE1MjQ4Njk1NDU1OTA5MTUyNjIiXSwiaWF0IjoxNzg0Mjk4NzA0LCJleHAiOjE3ODQ5MDM1MDR9.T6an1rb5wnV0KLfW-m_T5nbIkIZi7ZboW1NG67uo_Es';
const GUILD_ID = '1507671152389128272'; // Rage Optimizer Server
const BASE_URL = 'http://localhost:5000';

async function runTest() {
  console.log('1. Checking current subscriptions and database logs...');
  const statusRes = await fetch(`${BASE_URL}/api/modules/social_updates/status`, {
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'X-Guild-Id': GUILD_ID
    }
  });

  if (!statusRes.ok) {
    throw new Error(`Failed to fetch status: ${statusRes.status} ${await statusRes.text()}`);
  }

  const statusData = await statusRes.json();
  console.log(`Current active subscriptions count: ${statusData.subscriptions?.length}`);
  console.log('Current Queue Length:', statusData.queueLength);

  // Locate or clean up NASA test subscription to ensure clean slate
  const existingNasa = (statusData.subscriptions || []).find((s: any) => s.provider === 'instagram' && s.sourceId === 'nasa');
  if (existingNasa) {
    console.log(`\n2. Cleaning up existing @nasa subscription (ID: ${existingNasa.id})...`);
    await fetch(`${BASE_URL}/api/modules/social_updates/unsubscribe`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
        'X-Guild-Id': GUILD_ID
      },
      body: JSON.stringify({ id: existingNasa.id })
    });
  }

  console.log('\n3. Validating new subscription input "https://www.instagram.com/nasa?igsh=abc"...');
  const valRes = await fetch(`${BASE_URL}/api/modules/social_updates/validate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      'X-Guild-Id': GUILD_ID
    },
    body: JSON.stringify({ provider: 'instagram', input: 'https://www.instagram.com/nasa?igsh=abc' })
  });

  const valData = await valRes.json();
  console.log('Validation output:', JSON.stringify(valData, null, 2));
  if (!valData.valid || valData.sourceId !== 'nasa') {
    throw new Error('Instagram URL normalization validation failed!');
  }
  console.log('✅ URL correctly normalized to sourceId "nasa"');

  console.log('\n4. Creating fresh subscription to @nasa...');
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
      discordChannelId: '1507673259250942052', // test channel
      embedConfig: { color: '#EC4899', title: 'New Instagram Post' },
      contentTypes: { posts: true, reels: true, carousels: true, stories: true }
    })
  });

  if (!subRes.ok) {
    throw new Error(`Subscribe failed: ${await subRes.text()}`);
  }
  const subData = await subRes.json();
  const subId = subData.subscription.id;
  console.log(`✅ Subscription created successfully! ID: ${subId}`);

  console.log('\n5. Triggering a mock Reel in the sandbox simulator for @nasa...');
  const triggerRes = await fetch(`${BASE_URL}/api/modules/social_updates/sandbox/trigger`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      'X-Guild-Id': GUILD_ID
    },
    body: JSON.stringify({
      username: 'nasa',
      type: 'reel',
      title: 'Stateful Sandbox Reel Test 🚀'
    })
  });

  if (!triggerRes.ok) {
    throw new Error(`Sandbox trigger failed: ${await triggerRes.text()}`);
  }
  const triggerData = await triggerRes.json();
  console.log('Sandbox trigger output:', JSON.stringify(triggerData, null, 2));

  console.log('\nWaiting 3 seconds for comparison engine to process & queue notifications...');
  await new Promise(r => setTimeout(r, 3000));

  console.log('\n6. Checking audit logs for delivery status...');
  const finalStatusRes = await fetch(`${BASE_URL}/api/modules/social_updates/status`, {
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'X-Guild-Id': GUILD_ID
    }
  });
  const finalStatusData = await finalStatusRes.json();
  
  console.log('\nRecent Social Updates Audit Logs:');
  const relatedLogs = (finalStatusData.auditLogs || []).filter((l: any) => l.sourceId === 'nasa');
  console.log(JSON.stringify(relatedLogs, null, 2));

  console.log('\nRefactored Social Updates Integration Check Finished Successfully!');
}

runTest().catch(console.error);

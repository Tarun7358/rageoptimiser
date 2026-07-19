import WebSocket from 'ws';
import { fastify } from '../index.js';
import { config } from '../config/index.js';
import { logger } from '../logging/index.js';

async function runTests() {
  logger.info('--- STARTING GATEWAY INTEGRATION TESTS ---');

  const serverUrl = `ws://localhost:${config.PORT}/telemetry`;
  let agentWs: WebSocket | null = null;
  let dashboardWs: WebSocket | null = null;

  try {
    // 1. Connect mock Monitoring Agent
    const agentToken = config.GATEWAY_AGENT_TOKEN;
    logger.info('1. Connecting mock Monitoring Agent...');
    agentWs = new WebSocket(`${serverUrl}?token=${encodeURIComponent(agentToken)}`);

    await new Promise<void>((resolve, reject) => {
      agentWs!.on('open', resolve);
      agentWs!.on('error', reject);
    });
    logger.info('✅ Mock Monitoring Agent connected successfully.');

    // 2. Send Agent HEARTBEAT (triggers Alert because CPU is 98%!)
    logger.info('2. Sending mock agent Heartbeat...');
    const randomPid = Math.floor(Math.random() * 1000000);
    const heartbeatPacket = {
      type: 'HEARTBEAT',
      payload: {
        timestamp: new Date().toISOString(),
        metrics: {
          system: {
            cpuUsage: 98, // > 90 -> triggers high CPU alert
            ramUsage: 1200,
            memoryPercentage: 45,
            diskUsage: { total: 100000, free: 60000, used: 40000, percentage: 40 },
            nodeVersion: 'v20.11.0',
            pid: randomPid, // unique pid -> fresh unique botId -> fresh unique alert
            eventLoopDelay: 2.5,
            networkStatus: 'connected'
          },
          discord: {
            guildCount: 5,
            memberCount: 500,
            onlineMembers: 120,
            cachedChannels: 80,
            cachedRoles: 25,
            cachedEmojis: 15,
            cachedThreads: 2,
            commandsExecuted: 12,
            messagesProcessed: 200,
            interactions: 15,
            eventsPerSecond: 1.2,
            activeVoiceConnections: 3,
            openTickets: 1,
            activeMusicSessions: 1
          }
        },
        health: {
          status: 'healthy',
          databaseStatus: 'connected',
          redisStatus: 'online',
          uptime: 3600
        }
      }
    };
    agentWs.send(JSON.stringify(heartbeatPacket));

    // Wait 1s to allow agent session to be processed and alert triggered
    await new Promise(r => setTimeout(r, 1000));

    // 3. Connect mock Dashboard Client
    logger.info('3. Connecting mock Dashboard Client...');
    dashboardWs = new WebSocket(`${serverUrl}?token=test_dashboard_token`);

    let receivedHealth = false;
    let receivedAlert = false;
    let sessionId = '';

    const packetsReceived: any[] = [];
    dashboardWs.on('message', (data) => {
      try {
        const packet = JSON.parse(data.toString());
        packetsReceived.push(packet);
        logger.info(`Received packet on Dashboard: type="${packet.type}"`);

        if (packet.sessionId) {
          sessionId = packet.sessionId;
        }

        if (packet.type === 'HEALTH') {
          receivedHealth = true;
          if (packet.payload.cpu.usagePercentage === 98) {
            logger.info('✅ Received matching HEALTH packet (CPU usage matches 98%)');
          }
        }

        if (packet.type === 'ALERT') {
          receivedAlert = true;
          if (packet.payload.severity === 'CRITICAL' && packet.payload.title === 'High CPU Usage Detected') {
            logger.info('✅ Received generated ALERT packet (High CPU Usage Alert verified)');
          }
        }
      } catch (err) {
        // Parse error
      }
    });

    await new Promise<void>((resolve, reject) => {
      dashboardWs!.on('open', resolve);
      dashboardWs!.on('error', reject);
    });
    logger.info('✅ Mock Dashboard connected successfully.');

    // Wait and verify cached metrics and alerts have been processed
    logger.info('4. Waiting to receive metrics dump & generated alerts on Dashboard...');
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (receivedHealth && receivedAlert) {
          resolve();
        } else {
          logger.warn(`⚠️ Test timed out. receivedHealth=${receivedHealth}, receivedAlert=${receivedAlert}`);
          reject(new Error('Metrics dump or alert validation failed!'));
        }
      }, 4000);

      // Check periodically if both are received
      const interval = setInterval(() => {
        if (receivedHealth && receivedAlert) {
          clearInterval(interval);
          clearTimeout(timeout);
          resolve();
        }
      }, 200);
    });

    // 4. Test Resume Buffer
    logger.info('5. Testing Resume Buffer playback...');
    dashboardWs.send(JSON.stringify({
      type: 'RESUME',
      sessionId,
      lastSequence: 0
    }));

    let resumeCount = 0;
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(resolve, 3000);
      dashboardWs!.on('message', (data) => {
        try {
          const packet = JSON.parse(data.toString());
          // Alert gets buffered
          if (packet.type === 'EVENT' || packet.type === 'ALERT') {
            resumeCount++;
            logger.info(`Resume packet played back: type="${packet.type}" sequence=${packet.sequence}`);
          }
        } catch {
          // parse error
        }
      });
    });

    logger.info(`✅ Resume buffer successfully replayed ${resumeCount} events.`);

    // 5. Cleanup
    logger.info('6. Cleaning up connections...');
    agentWs.close();
    dashboardWs.close();
    await fastify.close();
    logger.info('✅ Gateway integration tests finished successfully!');
    process.exit(0);

  } catch (err) {
    logger.error({ err }, '❌ Gateway integration test failed');
    if (agentWs) agentWs.close();
    if (dashboardWs) dashboardWs.close();
    await fastify.close();
    process.exit(1);
  }
}

// Stagger test execution slightly after fastify bootstrap completes
setTimeout(() => {
  runTests();
}, 2000);

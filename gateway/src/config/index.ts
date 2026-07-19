import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export interface GatewayConfig {
  PORT: number;
  HOST: string;
  GATEWAY_AGENT_TOKEN: string;
  JWT_SECRET: string;
  DATABASE_PATH: string;
}

export const config: GatewayConfig = {
  PORT: parseInt(process.env.PORT || '6002', 10),
  HOST: process.env.HOST || '0.0.0.0',
  GATEWAY_AGENT_TOKEN: process.env.MONITORING_AUTH_TOKEN || process.env.GATEWAY_AGENT_TOKEN || 'default_telemetry_token',
  JWT_SECRET: process.env.JWT_SECRET || 'super_secret_dashboard_jwt',
  DATABASE_PATH: process.env.SQLITE_PATH || process.env.DATABASE_PATH || './gateway.sqlite',
};

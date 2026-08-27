import crypto from 'node:crypto';
import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_PATH: z.string().default('data/qujt.db'),
  JWT_SECRET: z.string().min(16).optional(),
  JWT_EXPIRES_IN: z.string().default('2h'),
  REFRESH_EXPIRES_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  COOKIE_PATH: z.string().default('/'),
  ADMIN_USERNAME: z.string().min(2).default('admin'),
  ADMIN_PASSWORD: z.string().min(8).optional(),
  ADMIN_EMAIL: z.email().optional(),
  OSS_BUCKET: z.string().optional(),
  OSS_REGION: z.string().optional(),
  OSS_ACCESS_KEY_ID: z.string().optional(),
  OSS_ACCESS_KEY_SECRET: z.string().optional(),
  OSS_ENDPOINT: z.string().optional(),
  OSS_CDN_DOMAIN: z.string().optional(),
});

export interface AppConfig {
  NODE_ENV: 'development' | 'test' | 'production';
  HOST: string;
  PORT: number;
  DATABASE_PATH: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  REFRESH_EXPIRES_DAYS: number;
  COOKIE_PATH: string;
  ADMIN_USERNAME: string;
  ADMIN_PASSWORD?: string;
  ADMIN_EMAIL?: string;
  OSS_BUCKET?: string;
  OSS_REGION?: string;
  OSS_ACCESS_KEY_ID?: string;
  OSS_ACCESS_KEY_SECRET?: string;
  OSS_ENDPOINT?: string;
  OSS_CDN_DOMAIN?: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('; ');
    throw new Error(`环境变量配置错误: ${issues}`);
  }
  const cfg = parsed.data;
  let secret = cfg.JWT_SECRET;
  if (!secret) {
    if (cfg.NODE_ENV === 'production') {
      throw new Error('生产环境必须设置 JWT_SECRET');
    }
    secret = crypto.randomBytes(32).toString('hex');
    console.warn('[config] 未设置 JWT_SECRET，已生成临时密钥（重启后失效，仅限开发环境）');
  }
  return { ...cfg, JWT_SECRET: secret };
}
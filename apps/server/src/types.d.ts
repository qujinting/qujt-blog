import type Database from 'better-sqlite3';
import type { AppConfig } from './config.js';
import type { DbUser } from './services/users.js';

declare module 'fastify' {
  interface FastifyInstance {
    db: Database.Database;
    cfg: AppConfig;
  }
  interface FastifyRequest {
    currentUser: DbUser;
  }
}

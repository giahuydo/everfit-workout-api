import { resolve } from 'node:path';

const NODE_ENVS = new Set(['development', 'test', 'production']);

type Environment = Record<string, string | number | boolean | undefined>;

function integer(value: string | undefined, name: string, fallback: number, options: { min?: number; max?: number } = {}): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || (options.min !== undefined && parsed < options.min) || (options.max !== undefined && parsed > options.max)) {
    throw new Error(`${name} must be an integer${options.min !== undefined ? ` between ${options.min} and ${options.max ?? 'Infinity'}` : ''}`);
  }
  return parsed;
}

function boolean(value: string | undefined, name: string, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error(`${name} must be true or false`);
}

/** Validates process configuration before Nest opens a database connection. */
export function validateEnvironment(env: NodeJS.ProcessEnv): Environment {
  const nodeEnv = env.NODE_ENV ?? 'development';
  if (!NODE_ENVS.has(nodeEnv)) throw new Error('NODE_ENV must be development, test, or production');

  const dbPassword = env.DB_PASSWORD ?? 'everfit';
  if (nodeEnv === 'production' && (!env.DB_PASSWORD || dbPassword === 'everfit')) {
    throw new Error('DB_PASSWORD must be explicitly set to a non-default value in production');
  }

  const dbSynchronize = boolean(env.DB_SYNCHRONIZE, 'DB_SYNCHRONIZE', false);
  if (nodeEnv === 'production' && dbSynchronize) {
    throw new Error('DB_SYNCHRONIZE must be false in production');
  }

  const catalogPath = env.EXERCISE_CATALOG_PATH;
  if (catalogPath !== undefined && !catalogPath.trim()) {
    throw new Error('EXERCISE_CATALOG_PATH must be a non-blank file path when set');
  }

  return {
    ...env,
    NODE_ENV: nodeEnv,
    PORT: integer(env.PORT, 'PORT', 3000, { min: 1, max: 65535 }),
    DB_HOST: env.DB_HOST ?? '127.0.0.1',
    DB_PORT: integer(env.DB_PORT, 'DB_PORT', 55432, { min: 1, max: 65535 }),
    DB_USER: env.DB_USER ?? 'everfit',
    DB_PASSWORD: dbPassword,
    DB_NAME: env.DB_NAME ?? 'everfit',
    // Migrations own schema changes in every environment. Synchronize remains
    // an explicit escape hatch for disposable local databases only.
    DB_SYNCHRONIZE: dbSynchronize,
    DB_POOL_MAX: integer(env.DB_POOL_MAX, 'DB_POOL_MAX', 10, { min: 1, max: 100 }),
    DB_CONNECTION_TIMEOUT_MS: integer(env.DB_CONNECTION_TIMEOUT_MS, 'DB_CONNECTION_TIMEOUT_MS', 5_000, { min: 100, max: 120_000 }),
    DB_IDLE_TIMEOUT_MS: integer(env.DB_IDLE_TIMEOUT_MS, 'DB_IDLE_TIMEOUT_MS', 30_000, { min: 1_000, max: 600_000 }),
    DB_STATEMENT_TIMEOUT_MS: integer(env.DB_STATEMENT_TIMEOUT_MS, 'DB_STATEMENT_TIMEOUT_MS', 15_000, { min: 100, max: 120_000 }),
    DB_LOCK_TIMEOUT_MS: integer(env.DB_LOCK_TIMEOUT_MS, 'DB_LOCK_TIMEOUT_MS', 5_000, { min: 100, max: 120_000 }),
    DB_IDLE_TRANSACTION_TIMEOUT_MS: integer(env.DB_IDLE_TRANSACTION_TIMEOUT_MS, 'DB_IDLE_TRANSACTION_TIMEOUT_MS', 30_000, { min: 1_000, max: 600_000 }),
    // Unset means the packaged config/exercises.json; relative paths resolve from the working directory.
    EXERCISE_CATALOG_PATH: catalogPath === undefined ? undefined : resolve(catalogPath.trim()),
  };
}

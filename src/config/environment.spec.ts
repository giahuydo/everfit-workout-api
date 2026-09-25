import { describe, expect, it } from 'vitest';
import { validateEnvironment } from './environment.js';

describe('validateEnvironment', () => {
  it('applies safe runtime defaults', () => {
    const config = validateEnvironment({});
    expect(config.PORT).toBe(3000);
    expect(config.DB_SYNCHRONIZE).toBe(false);
    expect(config.DB_STATEMENT_TIMEOUT_MS).toBe(15_000);
  });

  it('rejects invalid ports and unsafe production database configuration', () => {
    expect(() => validateEnvironment({ PORT: 'invalid' })).toThrow('PORT');
    expect(() => validateEnvironment({ NODE_ENV: 'production' })).toThrow('DB_PASSWORD');
    expect(() => validateEnvironment({
      NODE_ENV: 'production',
      DB_PASSWORD: 'non-default-secret',
      DB_SYNCHRONIZE: 'true',
    })).toThrow('DB_SYNCHRONIZE must be false in production');
  });

  it('resolves an optional exercise catalog path override', () => {
    expect(validateEnvironment({}).EXERCISE_CATALOG_PATH).toBeUndefined();
    expect(validateEnvironment({ EXERCISE_CATALOG_PATH: '/etc/everfit/exercises.json' }).EXERCISE_CATALOG_PATH)
      .toBe('/etc/everfit/exercises.json');
    expect(validateEnvironment({ EXERCISE_CATALOG_PATH: 'config/exercises.json' }).EXERCISE_CATALOG_PATH)
      .toBe(`${process.cwd()}/config/exercises.json`);
    expect(() => validateEnvironment({ EXERCISE_CATALOG_PATH: '  ' })).toThrow('EXERCISE_CATALOG_PATH');
  });
});

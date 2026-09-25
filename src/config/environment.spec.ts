import { describe, expect, it } from 'vitest';
import { validateEnvironment } from './environment.js';

describe('validateEnvironment', () => {
  it('applies safe runtime defaults', () => {
    const config = validateEnvironment({});
    expect(config.PORT).toBe(3000);
    expect(config.DB_SYNCHRONIZE).toBe(false);
    expect(config.DB_STATEMENT_TIMEOUT_MS).toBe(15_000);
  });

  it('rejects invalid ports and unsafe production database credentials', () => {
    expect(() => validateEnvironment({ PORT: 'invalid' })).toThrow('PORT');
    expect(() => validateEnvironment({ NODE_ENV: 'production' })).toThrow('DB_PASSWORD');
  });
});

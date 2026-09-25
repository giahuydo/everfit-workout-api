import { describe, expect, it } from 'vitest';
import { assertDisposableTestDatabase } from './database-test-guard.js';

describe('assertDisposableTestDatabase', () => {
  it('accepts an isolated disposable test database', () => {
    expect(() => assertDisposableTestDatabase('everfit_workflows_test', 'everfit', 'E2E_DB_NAME')).not.toThrow();
  });

  it('rejects unsafe or ambiguous database targets', () => {
    expect(() => assertDisposableTestDatabase('postgres', 'everfit', 'E2E_DB_NAME')).toThrow('must end with _test');
    expect(() => assertDisposableTestDatabase('everfit', 'everfit', 'E2E_DB_NAME')).toThrow('must end with _test');
    expect(() => assertDisposableTestDatabase('everfit_test', 'everfit_test', 'E2E_DB_NAME')).toThrow('must not match DB_NAME');
    expect(() => assertDisposableTestDatabase('everfit-test', 'everfit', 'E2E_DB_NAME')).toThrow('simple PostgreSQL identifier');
  });
});

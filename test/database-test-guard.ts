export function assertDisposableTestDatabase(
  databaseName: string,
  configuredApplicationDatabase: string | undefined,
  envName: string,
): void {
  if (!/^[a-z_][a-z0-9_]*$/.test(databaseName)) {
    throw new Error(`${envName} must be a simple PostgreSQL identifier`);
  }
  if (!databaseName.endsWith('_test')) {
    throw new Error(`${envName} must end with _test because the E2E suite drops and recreates it`);
  }
  if (configuredApplicationDatabase && databaseName === configuredApplicationDatabase) {
    throw new Error(`${envName} must not match DB_NAME because the E2E suite drops and recreates it`);
  }
}

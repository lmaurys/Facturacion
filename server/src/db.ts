import sql from 'mssql';
import { config } from './config.js';

let poolPromise: Promise<sql.ConnectionPool> | null = null;

const ensureSchema = async (pool: sql.ConnectionPool): Promise<void> => {
  await pool.request().query(`
    IF COL_LENGTH('dbo.tenant_settings', 'branding_json') IS NULL
    BEGIN
      ALTER TABLE dbo.tenant_settings
      ADD branding_json NVARCHAR(MAX) NOT NULL
        CONSTRAINT DF_tenant_settings_branding_json DEFAULT '{}'
    END
  `);

  await pool.request().query(`
    IF COL_LENGTH('dbo.tenant_settings', 'branding_json') IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM sys.check_constraints
        WHERE name = 'CK_tenant_settings_branding_json'
      )
    BEGIN
      ALTER TABLE dbo.tenant_settings
      ADD CONSTRAINT CK_tenant_settings_branding_json CHECK (ISJSON(branding_json) = 1);
    END
  `);
};

export const getPool = async (): Promise<sql.ConnectionPool> => {
  if (!config.azureSqlConnectionString) {
    throw new Error('AZURE_SQL_CONNECTION_STRING no está configurada.');
  }

  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(config.azureSqlConnectionString)
      .connect()
      .then(async (pool: sql.ConnectionPool) => {
        await ensureSchema(pool);
        return pool;
      });
  }

  return poolPromise;
};

export { sql };

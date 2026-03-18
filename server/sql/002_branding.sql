IF COL_LENGTH('dbo.tenant_settings', 'branding_json') IS NULL
BEGIN
  ALTER TABLE dbo.tenant_settings
  ADD branding_json NVARCHAR(MAX) NOT NULL
    CONSTRAINT DF_tenant_settings_branding_json DEFAULT '{}';
END
GO

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
GO

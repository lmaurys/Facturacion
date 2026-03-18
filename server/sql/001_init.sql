IF OBJECT_ID('dbo.tenants', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.tenants (
    tenant_id NVARCHAR(128) NOT NULL PRIMARY KEY,
    name NVARCHAR(200) NOT NULL,
    slug NVARCHAR(160) NOT NULL UNIQUE,
    source_url NVARCHAR(500) NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_tenants_created_at DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2 NOT NULL CONSTRAINT DF_tenants_updated_at DEFAULT SYSUTCDATETIME()
  );
END
GO

IF OBJECT_ID('dbo.tenant_memberships', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.tenant_memberships (
    tenant_id NVARCHAR(128) NOT NULL,
    user_id NVARCHAR(200) NOT NULL,
    email NVARCHAR(320) NOT NULL,
    display_name NVARCHAR(200) NOT NULL,
    role NVARCHAR(50) NOT NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_memberships_created_at DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2 NOT NULL CONSTRAINT DF_memberships_updated_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_tenant_memberships PRIMARY KEY (tenant_id, user_id),
    CONSTRAINT FK_tenant_memberships_tenants FOREIGN KEY (tenant_id) REFERENCES dbo.tenants (tenant_id)
  );

  CREATE INDEX IX_tenant_memberships_user_id ON dbo.tenant_memberships (user_id);
END
GO

IF OBJECT_ID('dbo.tenant_documents', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.tenant_documents (
    tenant_id NVARCHAR(128) NOT NULL,
    entity_type NVARCHAR(64) NOT NULL,
    entity_id NVARCHAR(128) NOT NULL,
    data NVARCHAR(MAX) NOT NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_tenant_documents_created_at DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2 NOT NULL CONSTRAINT DF_tenant_documents_updated_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_tenant_documents PRIMARY KEY (tenant_id, entity_type, entity_id),
    CONSTRAINT FK_tenant_documents_tenants FOREIGN KEY (tenant_id) REFERENCES dbo.tenants (tenant_id),
    CONSTRAINT CK_tenant_documents_json CHECK (ISJSON(data) = 1)
  );

  CREATE INDEX IX_tenant_documents_lookup ON dbo.tenant_documents (tenant_id, entity_type, updated_at DESC);
END
GO

IF OBJECT_ID('dbo.tenant_settings', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.tenant_settings (
    tenant_id NVARCHAR(128) NOT NULL PRIMARY KEY,
    invoice_prefix NVARCHAR(50) NOT NULL CONSTRAINT DF_tenant_settings_invoice_prefix DEFAULT '',
    invoice_start_number INT NOT NULL CONSTRAINT DF_tenant_settings_invoice_start_number DEFAULT 1,
    invoice_next_number INT NOT NULL CONSTRAINT DF_tenant_settings_invoice_next_number DEFAULT 1,
    invoice_footer_notes NVARCHAR(MAX) NOT NULL CONSTRAINT DF_tenant_settings_invoice_footer_notes DEFAULT '[]',
    branding_json NVARCHAR(MAX) NOT NULL CONSTRAINT DF_tenant_settings_branding_json DEFAULT '{}',
    source_url NVARCHAR(500) NULL,
    last_seeded_at DATETIME2 NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_tenant_settings_created_at DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2 NOT NULL CONSTRAINT DF_tenant_settings_updated_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_tenant_settings_tenants FOREIGN KEY (tenant_id) REFERENCES dbo.tenants (tenant_id),
    CONSTRAINT CK_tenant_settings_footer_json CHECK (ISJSON(invoice_footer_notes) = 1),
    CONSTRAINT CK_tenant_settings_branding_json CHECK (ISJSON(branding_json) = 1)
  );
END
GO

import { config } from './config.js';
import { loadSeedSnapshot } from './loadSeedSnapshot.js';
import { seedTenantSnapshot } from './repository.js';

const run = async () => {
  const snapshot = await loadSeedSnapshot();
  await seedTenantSnapshot(
    config.defaultTenant.tenantId,
    config.defaultTenant.name,
    config.defaultTenant.slug,
    snapshot,
  );

  console.log(
    `Tenant ${config.defaultTenant.tenantId} sembrado con ${snapshot.clients.length} clientes, ${snapshot.courses.length} cursos y ${snapshot.invoices.length} facturas.`,
  );
};

run().catch((error) => {
  console.error('Error sembrando tenant inicial:', error);
  process.exit(1);
});

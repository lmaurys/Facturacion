#!/usr/bin/env node

const rawBaseUrl = process.argv[2] || process.env.APP_URL || process.env.SAAS_APP_URL;

if (!rawBaseUrl) {
  console.error('Uso: node scripts/smoke-runtime-config.mjs <app-url>');
  process.exit(1);
}

const baseUrl = rawBaseUrl.replace(/\/+$/, '');

const requiredRuntimeKeys = [
  ['apiBaseUrl'],
  ['entra', 'clientId'],
  ['entra', 'tenantId'],
  ['entra', 'apiScope'],
];

const getPathValue = (input, path) =>
  path.reduce((current, segment) => (current && typeof current === 'object' ? current[segment] : undefined), input);

const assertOk = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const fetchJson = async (url) => {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  const text = await response.text();
  const contentType = response.headers.get('content-type') || '';

  assertOk(response.ok, `${url} respondió ${response.status}.`);
  assertOk(contentType.includes('application/json'), `${url} no respondió JSON.`);

  try {
    return {
      response,
      json: JSON.parse(text),
    };
  } catch (error) {
    throw new Error(`${url} devolvió contenido no parseable como JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
};

try {
  const runtimeConfigUrl = `${baseUrl}/api/public-config`;
  const healthUrl = `${baseUrl}/api/health`;

  const { json: runtimeConfig } = await fetchJson(runtimeConfigUrl);

  for (const path of requiredRuntimeKeys) {
    const value = getPathValue(runtimeConfig, path);
    assertOk(Boolean(String(value || '').trim()), `Falta ${path.join('.')} en ${runtimeConfigUrl}.`);
  }

  const { json: health } = await fetchJson(healthUrl);
  assertOk(health.ok === true, `${healthUrl} no devolvió ok=true.`);
  assertOk(health.authConfigured === true, `${healthUrl} no tiene authConfigured=true.`);

  console.log(`Smoke check OK para ${baseUrl}`);
  console.log(`runtime-config: ${runtimeConfig.entra.clientId} | ${runtimeConfig.entra.tenantId}`);
  console.log(`apiScope: ${runtimeConfig.entra.apiScope}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

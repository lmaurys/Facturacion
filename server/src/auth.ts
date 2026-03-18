import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { Request, Response, NextFunction } from 'express';
import { config, isAuthConfigured } from './config.js';
import { addMembership, ensureTenant, getMembershipsForUser } from './repository.js';
import type { AuthenticatedUser, TenantSummary } from './types.js';

const authorityTenant = config.entra.allowAnyTenant ? 'common' : config.entra.tenantId;
const issuer = `https://login.microsoftonline.com/${config.entra.tenantId}/v2.0`;
const jwks = createRemoteJWKSet(
  new URL(`https://login.microsoftonline.com/${authorityTenant}/discovery/v2.0/keys`),
);

export interface AuthenticatedRequest extends Request {
  authUser?: AuthenticatedUser;
  tenant?: TenantSummary;
  memberships?: TenantSummary[];
}

const parseBearerToken = (value: string | undefined): string | null => {
  if (!value) {
    return null;
  }

  const [scheme, token] = value.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return null;
  }

  return token;
};

const tenantGuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const resolveUserId = (claims: Record<string, unknown>): { userId: string; directoryTenantId?: string } => {
  const baseId = String(claims.oid || claims.sub || '').trim();
  const directoryTenantId = String(claims.tid || '').trim();

  if (!baseId) {
    return { userId: '', directoryTenantId: directoryTenantId || undefined };
  }

  if (!directoryTenantId || !config.entra.allowAnyTenant || directoryTenantId === config.entra.homeTenantId) {
    return {
      userId: baseId,
      directoryTenantId: directoryTenantId || undefined,
    };
  }

  return {
    userId: `${directoryTenantId}.${baseId}`,
    directoryTenantId,
  };
};

const getUserFromClaims = (claims: Record<string, unknown>): AuthenticatedUser => {
  const identity = resolveUserId(claims);
  return {
    userId: identity.userId,
    email: String(claims.preferred_username || claims.email || ''),
    name: String(claims.name || claims.preferred_username || claims.email || 'Usuario'),
    directoryTenantId: identity.directoryTenantId,
  };
};

const isValidIssuer = (claims: Record<string, unknown>): boolean => {
  const iss = String(claims.iss || '').trim();
  const tid = String(claims.tid || '').trim();

  if (!config.entra.allowAnyTenant) {
    return iss === issuer;
  }

  if (!tenantGuidPattern.test(tid)) {
    return false;
  }

  return iss === `https://login.microsoftonline.com/${tid}/v2.0`;
};

const slugify = (value: string, fallback: string): string => {
  const normalized = value
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return normalized || fallback;
};

const buildPersonalTenant = (user: AuthenticatedUser) => {
  const safeUserId = slugify(user.userId.slice(0, 12), 'usuario');
  const baseLabel = user.email || user.name || user.userId;
  const baseSlug = slugify(baseLabel.split('@')[0] || baseLabel, 'espacio');
  const tenantId = `tenant-${baseSlug}-${safeUserId}`.slice(0, 128);
  const slug = `espacio-${baseSlug}-${safeUserId}`.slice(0, 160);
  const name = `Espacio de ${user.name || user.email || 'Usuario'}`.slice(0, 200);

  return {
    tenantId,
    slug,
    name,
  };
};

const ensurePersonalTenant = async (user: AuthenticatedUser): Promise<void> => {
  if (!config.autoAssignFirstUser) {
    return;
  }

  const personalTenant = buildPersonalTenant(user);
  await ensureTenant(personalTenant.tenantId, personalTenant.name, personalTenant.slug);
  await addMembership(personalTenant.tenantId, user, 'owner');
};

export const requireAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!isAuthConfigured()) {
    res.status(503).json({
      message: 'La autenticación o la conexión a Azure SQL no están configuradas.',
    });
    return;
  }

  try {
    const token = parseBearerToken(req.headers.authorization);
    if (!token) {
      res.status(401).json({ message: 'Token no enviado.' });
      return;
    }

    const audiences = Array.from(
      new Set(
        [config.entra.audience, config.entra.clientId, `api://${config.entra.clientId}`].filter(Boolean),
      ),
    );
    const { payload } = await jwtVerify(token, jwks, {
      audience: audiences,
    });

    if (!isValidIssuer(payload as Record<string, unknown>)) {
      res.status(401).json({ message: 'Issuer no permitido para este token.' });
      return;
    }

    const user = getUserFromClaims(payload as Record<string, unknown>);
    if (!user.userId) {
      res.status(401).json({ message: 'No se pudo resolver el usuario autenticado.' });
      return;
    }

    req.authUser = user;
    next();
  } catch (error) {
    console.error('Error validando token Entra ID:', error);
    res.status(401).json({ message: 'No se pudo validar el token de acceso.' });
  }
};

export const requireTenantContext = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  if (!req.authUser) {
    res.status(401).json({ message: 'Usuario no autenticado.' });
    return;
  }

  try {
    let memberships = await getMembershipsForUser(req.authUser.userId);
    if (memberships.length === 0) {
      await ensurePersonalTenant(req.authUser);
      memberships = await getMembershipsForUser(req.authUser.userId);
    }

    req.memberships = memberships;

    if (memberships.length === 0) {
      res.status(403).json({
        message: 'Tu usuario no tiene un tenant asignado todavía.',
      });
      return;
    }

    const requestedTenantId = String(req.headers['x-tenant-id'] || '').trim();
    const tenant =
      (requestedTenantId
        ? memberships.find((entry) => entry.tenantId === requestedTenantId)
        : memberships.length === 1
          ? memberships[0]
          : undefined) || null;

    if (!tenant) {
      res.status(400).json({
        message: 'Debes seleccionar un tenant válido para continuar.',
        memberships,
      });
      return;
    }

    req.tenant = tenant;
    next();
  } catch (error) {
    console.error('Error resolviendo tenant:', error);
    res.status(500).json({ message: 'No se pudo resolver el tenant actual.' });
  }
};

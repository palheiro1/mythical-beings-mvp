import { Buffer } from 'node:buffer';

const forbiddenTextPatterns = [
  ['server_secret_name', /\bSUPABASE_SERVICE_ROLE_KEY\b/],
  ['server_secret_name', /\bWISDOM_DUEL_ESCROW_SIGNER_PRIVATE_KEY\b/],
  ['private_key_material', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['source_map_reference', /[#@]\s*sourceMappingURL\s*=/],
];

const jwtPattern = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g;

const decodeJwtPayload = (token) => {
  try {
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
  } catch {
    return null;
  }
};

export const isForbiddenPublicFile = (relativePath) => {
  const basename = relativePath.replaceAll('\\', '/').split('/').at(-1)?.toLowerCase() ?? '';
  return basename.startsWith('.env')
    || basename.endsWith('.map')
    || basename.endsWith('.pem')
    || basename.endsWith('.key')
    || basename === 'id_rsa'
    || basename === 'id_ed25519';
};

export const scanPublicText = (relativePath, text) => {
  const findings = [];

  for (const [kind, pattern] of forbiddenTextPatterns) {
    if (pattern.test(text)) findings.push({ relativePath, kind });
  }

  for (const token of text.match(jwtPattern) ?? []) {
    const payload = decodeJwtPayload(token);
    if (payload?.role === 'service_role' || payload?.app_metadata?.role === 'service_role') {
      findings.push({ relativePath, kind: 'service_role_jwt' });
      break;
    }
  }

  return findings;
};

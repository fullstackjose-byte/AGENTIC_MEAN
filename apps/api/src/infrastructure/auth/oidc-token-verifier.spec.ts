import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  SignJWT,
} from 'jose';
import { OidcTokenVerifier } from './oidc-token-verifier.js';

describe('OidcTokenVerifier', () => {
  it('verifies signature and claims, maps roles, and uses deterministic precedence', async () => {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const jwk = await exportJWK(publicKey);
    jwk.kid = 'test-key';
    const verifier = new OidcTokenVerifier(
      {
        issuer: 'https://issuer.example',
        audience: 'helpdesk-api',
        jwksUri: 'https://issuer.example/jwks',
        rolesClaim: 'realm_access.roles',
        roleMap: { helpdesk_admin: 'ADMIN', helpdesk_user: 'END_USER' },
        algorithms: ['RS256'],
      },
      createLocalJWKSet({ keys: [jwk] }),
    );
    const token = await new SignJWT({
      realm_access: { roles: ['helpdesk_user', 'helpdesk_admin'] },
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setSubject('user-42')
      .setIssuer('https://issuer.example')
      .setAudience('helpdesk-api')
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(privateKey);

    await expect(verifier.verify(token)).resolves.toEqual({
      id: 'user-42',
      role: 'ADMIN',
    });
  });

  it('rejects tokens with an invalid audience', async () => {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const jwk = await exportJWK(publicKey);
    jwk.kid = 'test-key';
    const verifier = new OidcTokenVerifier(
      {
        issuer: 'https://issuer.example',
        audience: 'helpdesk-api',
        jwksUri: 'https://issuer.example/jwks',
        rolesClaim: 'roles',
        roleMap: {},
        algorithms: ['RS256'],
      },
      createLocalJWKSet({ keys: [jwk] }),
    );
    const token = await new SignJWT({ roles: ['ADMIN'] })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setSubject('user-42')
      .setIssuer('https://issuer.example')
      .setAudience('another-api')
      .setExpirationTime('5m')
      .sign(privateKey);

    await expect(verifier.verify(token)).rejects.toThrow();
  });
});

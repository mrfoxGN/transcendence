import { InternalServerErrorException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';

jest.mock('@nestjs/config', () => ({
  ConfigService: class ConfigService {},
}));

import { GitHubTokenCryptoService } from './github-token-crypto.service';

describe('GitHubTokenCryptoService', () => {
  const repositoryId = '43181083-7955-41bf-bac8-425ac2f80ac2';
  const otherRepositoryId = 'd30a15a4-bb32-4c4f-a34b-7de84cc7ab63';
  const token = 'ghu_example_test_token';

  const encryptionKey = randomBytes(32).toString('base64');

  const createService = (key?: string) =>
    new GitHubTokenCryptoService({
      get: jest.fn().mockReturnValue(key),
    } as never);

  it('encrypts and decrypts a GitHub token', () => {
    const service = createService(encryptionKey);

    const encrypted = service.encrypt(token, repositoryId);
    const decrypted = service.decrypt(encrypted, repositoryId);

    expect(decrypted).toBe(token);
    expect(encrypted).not.toContain(token);
  });

  it('generates different ciphertext for the same token', () => {
    const service = createService(encryptionKey);

    const first = service.encrypt(token, repositoryId);
    const second = service.encrypt(token, repositoryId);

    expect(first).not.toBe(second);
  });

  it('rejects decryption with a different repository ID', () => {
    const service = createService(encryptionKey);
    const encrypted = service.encrypt(token, repositoryId);

    expect(() =>
      service.decrypt(encrypted, otherRepositoryId),
    ).toThrow(InternalServerErrorException);
  });

  it('rejects tampered encrypted credentials', () => {
    const service = createService(encryptionKey);
    const encrypted = service.encrypt(token, repositoryId);

    const parts = encrypted.split('.');
    const ciphertext = Buffer.from(parts[3], 'base64url');

    ciphertext[0] ^= 0xff;
    parts[3] = ciphertext.toString('base64url');

    expect(() =>
      service.decrypt(parts.join('.'), repositoryId),
    ).toThrow(InternalServerErrorException);
  });

  it('rejects a missing encryption key', () => {
    const service = createService();

    expect(() =>
      service.encrypt(token, repositoryId),
    ).toThrow(InternalServerErrorException);
  });

  it('rejects an invalid encryption key', () => {
    const service = createService('invalid-key');

    expect(() =>
      service.encrypt(token, repositoryId),
    ).toThrow(InternalServerErrorException);
  });
});

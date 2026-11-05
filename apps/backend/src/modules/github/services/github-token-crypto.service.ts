import {
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from 'node:crypto';

@Injectable()
export class GitHubTokenCryptoService {
  constructor(
    private readonly configService: ConfigService,
  ) {}

  private getEncryptionKey(): Buffer {
    const encoded = this.configService.get<string>(
      'GITHUB_TOKEN_ENCRYPTION_KEY',
    );

    if (!encoded) {
      throw new InternalServerErrorException(
        'GitHub token encryption is not configured',
      );
    }

    const key = Buffer.from(encoded, 'base64');

    if (
      key.length !== 32 ||
      key.toString('base64') !== encoded
    ) {
      throw new InternalServerErrorException(
        'Invalid GitHub token encryption key',
      );
    }

    return key;
  }

  encrypt(token: string, repositoryId: string): string {
    const key = this.getEncryptionKey();
    const iv = randomBytes(12);

    const cipher = createCipheriv('aes-256-gcm', key, iv);

    // Bind the encrypted token to this repository.
    cipher.setAAD(Buffer.from(repositoryId, 'utf8'));

    const encrypted = Buffer.concat([
      cipher.update(token, 'utf8'),
      cipher.final(),
    ]);

    const authTag = cipher.getAuthTag();

    return [
      'v1',
      iv.toString('base64url'),
      authTag.toString('base64url'),
      encrypted.toString('base64url'),
    ].join('.');
  }

  decrypt(payload: string, repositoryId: string): string {
    const key = this.getEncryptionKey();

    try {
      const parts = payload.split('.');

      if (parts.length !== 4 || parts[0] !== 'v1') {
        throw new Error('Invalid encrypted token format');
      }

      const iv = Buffer.from(parts[1], 'base64url');
      const authTag = Buffer.from(parts[2], 'base64url');
      const encrypted = Buffer.from(parts[3], 'base64url');

      if (iv.length !== 12 || authTag.length !== 16) {
        throw new Error('Invalid encrypted token');
      }

      const decipher = createDecipheriv(
        'aes-256-gcm',
        key,
        iv,
      );

      decipher.setAAD(Buffer.from(repositoryId, 'utf8'));
      decipher.setAuthTag(authTag);

      return Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      throw new InternalServerErrorException(
        'Unable to decrypt GitHub credentials',
      );
    }
  }
}

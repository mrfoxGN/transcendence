import {
  BadRequestException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';

import {
  verifyGitHubWebhookSignature,
} from './github-webhook-signature';

describe('GitHub Webhook Signature Verification', () => {

  // GitHub's official HMAC test vector.
  const secret = "It's a Secret to Everybody";

  const payload = Buffer.from(
    'Hello, World!',
    'utf8',
  );

  const validSignature =
    'sha256=757107ea0eb2509fc211221cce984b8a37570b6d7586c22c46f4379c8b043e17';

  it('accepts a valid GitHub signature', () => {
    expect(() =>
      verifyGitHubWebhookSignature(
        payload,
        validSignature,
        secret,
      ),
    ).not.toThrow();
  });

  it('rejects a modified payload', () => {
    const modified = Buffer.from(
      'Hello, World?',
      'utf8',
    );

    expect(() =>
      verifyGitHubWebhookSignature(
        modified,
        validSignature,
        secret,
      ),
    ).toThrow(UnauthorizedException);
  });

  it('rejects an incorrect signature', () => {
    const invalidSignature =
      `sha256=${'0'.repeat(64)}`;

    expect(() =>
      verifyGitHubWebhookSignature(
        payload,
        invalidSignature,
        secret,
      ),
    ).toThrow(UnauthorizedException);
  });

  it('rejects a missing signature', () => {
    expect(() =>
      verifyGitHubWebhookSignature(
        payload,
        undefined,
        secret,
      ),
    ).toThrow(UnauthorizedException);
  });

  it('rejects a malformed signature', () => {
    expect(() =>
      verifyGitHubWebhookSignature(
        payload,
        'invalid',
        secret,
      ),
    ).toThrow(UnauthorizedException);
  });

  it('rejects a missing raw body', () => {
    expect(() =>
      verifyGitHubWebhookSignature(
        undefined,
        validSignature,
        secret,
      ),
    ).toThrow(BadRequestException);
  });

  it('rejects a missing webhook secret', () => {
    expect(() =>
      verifyGitHubWebhookSignature(
        payload,
        validSignature,
        undefined,
      ),
    ).toThrow(ServiceUnavailableException);
  });

});

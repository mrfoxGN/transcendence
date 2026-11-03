import {
  BadRequestException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';

import {
  createHmac,
  timingSafeEqual,
} from 'node:crypto';

/**
 * Verifies that a webhook payload has a valid
 * HMAC-SHA256 signature.
 *
 * Throws an exception if verification fails.
 */
export function verifyGitHubWebhookSignature(
  rawBody: Buffer | undefined,
  signature: string | undefined,
  secret: string | undefined,
): void {

  // 1. Fail closed if the webhook secret is missing.
  if (!secret) {
    throw new ServiceUnavailableException(
      'GitHub webhook verification is not configured',
    );
  }

  // 2. We must verify the original HTTP bytes.
  if (!Buffer.isBuffer(rawBody)) {
    throw new BadRequestException(
      'Raw webhook body is required',
    );
  }

  // 3. Check GitHub's signature format.
  if (
    !signature ||
    !/^sha256=[a-f0-9]{64}$/.test(signature)
  ) {
    throw new UnauthorizedException(
      'Invalid GitHub webhook signature',
    );
  }

  // 4. Calculate the expected signature.
  const expected = createHmac('sha256', secret)
    .update(rawBody)
    .digest();

  // 5. Decode the signature supplied by GitHub.
  const received = Buffer.from(
    signature.slice('sha256='.length),
    'hex',
  );

  // 6. Compare using a timing-safe operation.
  if (
    received.length !== expected.length ||
    !timingSafeEqual(received, expected)
  ) {
    throw new UnauthorizedException(
      'Invalid GitHub webhook signature',
    );
  }

  // Success: the payload has a valid signature.
}

import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  Post,
  Req,
  ServiceUnavailableException,
} from '@nestjs/common';

import type { RawBodyRequest } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

import { GitHubWebhookRoutingService } from '../services/github-webhook-routing.service';
import { GitHubWebhookPushService } from '../services/github-webhook-push.service';
import type { GitHubPushProcessingResult } from '../services/github-webhook-push.service';
import {
  verifyGitHubWebhookSignature,
} from '../utils/github-webhook-signature';

@Controller('github')
export class GitHubWebhookController {
  constructor(
    private readonly configService: ConfigService,
    private readonly routingService: GitHubWebhookRoutingService,
    private readonly pushService: GitHubWebhookPushService,
  ) {}

  @Post('webhook')
  @HttpCode(200)
  async receiveWebhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers('x-hub-signature-256') signature?: string,
    @Headers('x-github-event') event?: string,
    @Headers('x-github-delivery') deliveryId?: string,
  ): Promise<
    { verified: boolean; event: string } | GitHubPushProcessingResult
  > {
    const secret = this.configService.get<string>(
      'GITHUB_WEBHOOK_SECRET',
    );

    verifyGitHubWebhookSignature(
      request.rawBody,
      signature,
      secret,
    );

    if (!event || !/^[a-z_]{1,100}$/.test(event)) {
      throw new BadRequestException(
        'Invalid GitHub event type',
      );
    }

    if (
      !deliveryId ||
      !/^[a-zA-Z0-9-]{1,100}$/.test(deliveryId)
    ) {
      throw new BadRequestException(
        'Invalid GitHub delivery ID',
      );
    }

    if (event === 'ping') {
      return {
        verified: true,
        event: 'ping',
      };
    }

    if (event === 'push') {
      return this.pushService.processPush(
        deliveryId,
        request.body as unknown,
      );
    }

    const supportedEvents = [
      'pull_request',
      'create',
      'delete',
    ];

    if (!supportedEvents.includes(event)) {
      throw new ServiceUnavailableException(
        'GitHub event type is not supported yet',
      );
    }

    // This lookup occurs only after signature verification.
    // A single repository may belong to multiple workspaces.
    await this.routingService.resolveTargets(
      request.body as unknown,
    );

    // Event processing is not implemented yet.
    // Do not acknowledge the delivery as processed.
    throw new ServiceUnavailableException(
      'GitHub event processing is not enabled yet',
    );
  }
}

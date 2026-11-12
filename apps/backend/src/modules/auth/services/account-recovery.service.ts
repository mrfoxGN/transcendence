import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import { IsNull, LessThanOrEqual, MoreThan, Or, Repository } from 'typeorm';
import { UserStatus } from '../../../database/enums/database.enums';
import { WorkspaceChatGateway } from '../../chat/gateways/workspace-chat.gateway';
import { DirectChatGateway } from '../../social/gateways/direct-chat.gateway';
import { User } from '../../users/entities/user.entity';

const minute = 60_000;
const actions = {
  verify: { digest: 'emailVerifyDigest', expires: 'emailVerifyExpiresAt', lifetime: 24 * 60 * minute, page: '/verify-email', subject: 'Verify your DevUP email' },
  reset: { digest: 'passwordResetDigest', expires: 'passwordResetExpiresAt', lifetime: 30 * minute, page: '/reset-password', subject: 'Reset your DevUP password' },
} as const;

function digestToken(email: string, token: string) {
  return createHash('sha256').update(email).update('\0').update(token).digest('hex');
}

@Injectable()
export class AccountRecoveryService {
  private readonly logger = new Logger(AccountRecoveryService.name);

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly config: ConfigService,
    private readonly directChat: DirectChatGateway,
    private readonly workspaceChat: WorkspaceChatGateway,
  ) {}

  private mailSettings() {
    const key = this.config.get<string>('RESEND_API_KEY');
    const from = this.config.get<string>('AUTH_EMAIL_FROM');
    const publicUrl = this.config.get<string>('AUTH_PUBLIC_URL');
    let origin: URL | undefined;
    try { if (publicUrl) origin = new URL(publicUrl); } catch { /* handled below */ }
    if (!key || !from || !origin || origin.username || origin.password
      || (origin.protocol !== 'https:' && !(origin.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(origin.hostname)))) {
      throw new ServiceUnavailableException('Account email is temporarily unavailable.');
    }
    return { key, from, origin };
  }

  async requestVerification(userId: string) {
    const user = await this.users.findOneBy({ id: userId, status: UserStatus.ACTIVE, deletedAt: IsNull() });
    if (!user || user.verifiedEmail === user.email) return;
    await this.issue(user, 'verify', this.mailSettings());
  }

  requestPasswordReset(email: string) {
    const settings = this.mailSettings();
    // Give the public endpoint the same response regardless of account or delivery outcome.
    void this.users.findOneBy({ email, status: UserStatus.ACTIVE, deletedAt: IsNull() })
      .then(user => user && this.issue(user, 'reset', settings))
      .catch(() => this.logger.warn('Password reset email could not be issued'));
  }

  private async issue(user: User, action: keyof typeof actions, settings: ReturnType<AccountRecoveryService['mailSettings']>) {
    const { digest, expires, lifetime, page, subject } = actions[action];
    const token = user.id + '.' + randomBytes(32).toString('base64url');
    const hash = digestToken(user.email, token);
    const now = Date.now();
    const criteria = { id: user.id, email: user.email, status: UserStatus.ACTIVE, deletedAt: IsNull() };
    const result = await this.users.update({
      ...criteria, [expires]: Or(IsNull(), LessThanOrEqual(new Date(now + lifetime - minute))),
    }, { [digest]: hash, [expires]: new Date(now + lifetime) });
    if (!result.affected) return;

    const url = new URL(page, settings.origin);
    url.hash = new URLSearchParams({ token }).toString();
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + settings.key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: settings.from, to: [user.email], subject, text: subject + '\n\n' + url.href + '\n\nIf you did not request this, you can ignore this email.' }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error('Email delivery failed');
    } catch {
      await this.users.update({ ...criteria, [digest]: hash }, { [digest]: null, [expires]: null });
      throw new ServiceUnavailableException('Could not send email. Try again later.');
    }
  }

  private async tokenUser(token: string) {
    const id = token.split('.')[0];
    const user = await this.users.findOneBy({ id, status: UserStatus.ACTIVE, deletedAt: IsNull() });
    if (!user) throw new BadRequestException('This link is invalid or has expired.');
    return user;
  }

  async verifyEmail(token: string) {
    const user = await this.tokenUser(token);
    const result = await this.users.update({
      id: user.id, email: user.email, status: UserStatus.ACTIVE, deletedAt: IsNull(),
      emailVerifyDigest: digestToken(user.email, token), emailVerifyExpiresAt: MoreThan(new Date()),
    }, { verifiedEmail: user.email, emailVerifyDigest: null, emailVerifyExpiresAt: null });
    if (!result.affected) throw new BadRequestException('This link is invalid or has expired.');
  }

  async resetPassword(token: string, password: string) {
    const user = await this.tokenUser(token);
    const hash = digestToken(user.email, token);
    if (user.passwordResetDigest !== hash || !user.passwordResetExpiresAt || user.passwordResetExpiresAt <= new Date()) {
      throw new BadRequestException('This link is invalid or has expired.');
    }
    const passwordHash = await argon2.hash(password);
    const result = await this.users.update({
      id: user.id, email: user.email, status: UserStatus.ACTIVE, deletedAt: IsNull(),
      passwordResetDigest: hash, passwordResetExpiresAt: MoreThan(new Date()),
    }, {
      passwordHash, passwordResetDigest: null, passwordResetExpiresAt: null,
      updatedAt: new Date(), tokenVersion: () => 'token_version + 1',
    });
    if (!result.affected) throw new BadRequestException('This link is invalid or has expired.');
    this.directChat.disconnectUser(user.id);
    this.workspaceChat.disconnectUser(user.id);
  }
}

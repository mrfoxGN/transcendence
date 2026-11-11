import { BadRequestException, ConflictException } from '@nestjs/common';

export const defaultWorkspaceTimeZone = 'Africa/Casablanca';

export function assertWorkspaceWritable(workspace: { archivedAt?: Date | null } | undefined) {
  if (workspace?.archivedAt) throw new ConflictException('This workspace is archived. Restore it before making changes.');
}

export function validateWorkspaceTimeZone(value: string) {
  if (typeof value !== 'string' || !/^(?:UTC|[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+)+)$/.test(value)) {
    throw new BadRequestException('Choose a valid IANA time zone.');
  }
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return value;
  } catch {
    throw new BadRequestException('Choose a valid IANA time zone.');
  }
}

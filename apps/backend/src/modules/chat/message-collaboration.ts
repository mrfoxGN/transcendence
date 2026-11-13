import { BadRequestException, NotFoundException, StreamableFile } from '@nestjs/common';
import { FindOptionsWhere, In, IsNull, ObjectLiteral, Repository } from 'typeorm';
import type { Response } from 'express';

export const chatAttachmentLimit = 5 * 1024 * 1024;

export function attachmentFields(file?: Express.Multer.File) {
  if (!file) return {};
  if (!file.size || file.size > chatAttachmentLimit) throw new BadRequestException('Choose a file between 1 byte and 5 MB');
  const name = file.originalname.split(/[\\/]/).at(-1)?.replace(/[\x00-\x1f\x7f]/g, '_').trim();
  return { attachmentName: name?.slice(0, 255) || 'Attachment', attachmentData: file.buffer };
}

interface MessageFields {
  id: string;
  senderId: string | null;
  content: string;
  replyToId?: string | null;
  attachmentName?: string | null;
}

export async function messageContext<M extends MessageFields>(
  repository: Repository<M>, scope: ObjectLiteral, messages: M[],
) {
  const ids = [...new Set(messages.flatMap(message => message.replyToId ? [message.replyToId] : []))];
  const sources = ids.length ? await repository.findBy({ ...scope, id: In(ids), deletedAt: IsNull() } as unknown as FindOptionsWhere<M>) : [];
  const byId = new Map(sources.map(source => [source.id, source]));
  return (message: M) => {
    const source = message.replyToId ? byId.get(message.replyToId) : undefined;
    return {
      ...(message.replyToId ? {
        reply: {
          id: message.replyToId,
          senderId: source?.senderId ?? null,
          preview: source ? source.content.slice(0, 240) || source.attachmentName || 'Attachment' : 'Original message unavailable',
          unavailable: !source,
        },
      } : {}),
      ...(message.attachmentName ? { attachmentName: message.attachmentName } : {}),
    };
  };
}

export async function validateReply<M extends MessageFields>(
  repository: Repository<M>, scope: ObjectLiteral, replyToId?: string,
) {
  if (replyToId && !await repository.findOneBy({ ...scope, id: replyToId, deletedAt: IsNull() } as unknown as FindOptionsWhere<M>)) {
    throw new NotFoundException('Original message not found');
  }
}

export function searchMessages<M extends ObjectLiteral>(
  repository: Repository<M>, column: 'workspace_id' | 'conversation_id',
  threadId: string, query: string, skip: number, limit: number,
) {
  const pattern = '%' + query.replace(/[!%_]/g, value => '!' + value) + '%';
  return repository.createQueryBuilder('message')
    .where(`message.${column} = :threadId AND message.deleted_at IS NULL`, { threadId })
    .andWhere("(message.content LIKE :pattern ESCAPE '!' OR message.attachment_name LIKE :pattern ESCAPE '!')", { pattern })
    .orderBy('message.created_at', 'DESC').addOrderBy('message.id', 'DESC')
    .offset(skip).limit(limit).getMany();
}

export async function downloadChatAttachment<M extends MessageFields & { attachmentData?: Buffer | null }>(
  repository: Repository<M>, column: 'workspace_id' | 'conversation_id',
  threadId: string, messageId: string, response: Response,
) {
  const message = await repository.createQueryBuilder('message')
    .addSelect('message.attachmentData')
    .where(`message.${column} = :threadId AND message.id = :messageId AND message.deleted_at IS NULL`, { threadId, messageId })
    .getOne();
  if (!message?.attachmentName || !message.attachmentData) throw new NotFoundException('Attachment not found');
  response.attachment(message.attachmentName);
  response.setHeader('Content-Type', 'application/octet-stream');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Cache-Control', 'private, no-store');
  return new StreamableFile(message.attachmentData);
}

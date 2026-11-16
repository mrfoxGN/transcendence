import { BadRequestException } from '@nestjs/common';
import { ObjectLiteral, Repository } from 'typeorm';

export function listByMessageCursor<Message extends ObjectLiteral>(
  repository: Repository<Message>,
  threadColumn: 'workspace_id' | 'conversation_id',
  threadId: string,
  cursor: { before?: string; after?: string },
  limit: number,
): Promise<Message[]> {
  if (cursor.before && cursor.after) {
    throw new BadRequestException('Choose either older or newer messages');
  }
  const direction = cursor.after ? 'ASC' : 'DESC';
  const comparison = cursor.after ? '>' : '<';
  return repository.createQueryBuilder('message')
    .innerJoin(repository.metadata.tableName, 'anchor', `anchor.id = :cursor AND anchor.${threadColumn} = :threadId`, {
      cursor: cursor.after ?? cursor.before,
      threadId,
    })
    .where(`message.${threadColumn} = :threadId`)
    .andWhere('message.deleted_at IS NULL')
    .andWhere(`(message.created_at, message.id) ${comparison} (anchor.created_at, anchor.id)`)
    .orderBy('message.created_at', direction)
    .addOrderBy('message.id', direction)
    .limit(limit)
    .getMany();
}

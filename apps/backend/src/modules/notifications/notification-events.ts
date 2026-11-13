import { createHash } from 'node:crypto';
import { EntityManager } from 'typeorm';
import { Task } from '../tasks/entities/task.entity';

export const notificationCategories = {
  assignments: ['TASK_ASSIGNED'],
  mentions: ['TASK_MENTION', 'CHAT_MENTION'],
  comments: ['WATCHED_TASK_COMMENT'],
  status: ['WATCHED_TASK_STATUS'],
  invitations: ['WORKSPACE_INVITATION', 'WORKSPACE_INVITATION_ACCEPTED', 'FRIEND_REQUEST', 'FRIEND_REQUEST_ACCEPTED'],
  messages: ['DIRECT_MESSAGE'],
} as const;

export const configurableCategories = ['assignments', 'mentions', 'comments', 'status'] as const;
type Category = typeof configurableCategories[number];

interface Delivery {
  eventId: string;
  workspaceId: string;
  actorId: string;
  resourceType: 'task' | 'workspace_chat';
  resourceId: string;
  candidates: Map<string, Category>;
  message: (category: Category) => string;
}

export async function deliverWorkspaceNotifications(manager: EntityManager, event: Delivery) {
  const candidates = [...event.candidates.keys()].filter(id => id !== event.actorId);
  if (!candidates.length) return;
  const eligible: { id: string; disabled: Category | null }[] = await manager.query(
    `SELECT member.user_id AS id, preference.category AS disabled
     FROM workspace_memberships member
     JOIN users user ON user.id = member.user_id AND user.status = 'ACTIVE' AND user.deleted_at IS NULL
     LEFT JOIN notification_preferences preference ON preference.user_id = member.user_id
     WHERE member.workspace_id = ? AND member.user_id IN (?)`,
    [event.workspaceId, candidates],
  );
  const recipients = new Set(eligible.map(row => row.id));
  for (const row of eligible) {
    if (row.disabled === event.candidates.get(row.id)) recipients.delete(row.id);
  }
  for (const userId of recipients) {
    const category = event.candidates.get(userId)!;
    const key = createHash('sha256').update(JSON.stringify([event.eventId, userId])).digest('hex');
    const id = `${key.slice(0, 8)}-${key.slice(8, 12)}-4${key.slice(13, 16)}-8${key.slice(17, 20)}-${key.slice(20, 32)}`;
    const type = category === 'mentions' && event.resourceType === 'workspace_chat'
      ? 'CHAT_MENTION'
      : notificationCategories[category][0];
    await manager.query(
      `INSERT INTO notifications
       (id, user_id, workspace_id, type, message, related_resource_type, related_resource_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP(6))
       ON DUPLICATE KEY UPDATE id = notifications.id`,
      [id, userId, event.workspaceId, type, event.message(category), event.resourceType, event.resourceId],
    );
  }
}

export async function mentionRecipients(manager: EntityManager, workspaceId: string, content: string): Promise<string[]> {
  const names = [...content.matchAll(/(?:^|\s)@(?:"([^"\r\n]{1,50})"|([\p{L}\p{N}_-]{1,50})(?![\p{L}\p{N}_-]))/gu)]
    .map(match => match[1] ?? match[2]);
  if (!names.length) return [];
  const rows: { id: string }[] = await manager.query(
    `SELECT user.id FROM users user
     JOIN workspace_memberships member ON member.user_id = user.id
     WHERE member.workspace_id = ? AND user.username IN (?)`,
    [workspaceId, names],
  );
  return rows.map(row => row.id);
}

export async function notifyTask(manager: EntityManager, task: Task, actorId: string, eventId: string,
  category: 'assignments' | 'comments' | 'status', options: { assigneeId?: string; content?: string } = {},
) {
  const recipients = new Map<string, Category>();
  if (category === 'assignments') {
    if (options.assigneeId) recipients.set(options.assigneeId, category);
  } else {
    const watchers: { userId: string }[] = await manager.query(
      'SELECT user_id AS userId FROM task_watchers WHERE task_id = ?', [task.id],
    );
    for (const { userId } of watchers) recipients.set(userId, category);
    if (category === 'status') {
      const assignments: { userId: string }[] = await manager.query(
        'SELECT user_id AS userId FROM task_assignments WHERE task_id = ?', [task.id],
      );
      for (const { userId } of assignments) recipients.set(userId, category);
    }
    if (options.content) {
      for (const id of await mentionRecipients(manager, task.workspaceId, options.content)) recipients.set(id, 'mentions');
    }
  }
  const messages: Record<Category, string> = {
    assignments: `You were assigned to ${task.title}`,
    comments: `New comment on ${task.title}`,
    mentions: `You were mentioned in a comment on ${task.title}`,
    status: `Status changed on ${task.title}`,
  };
  await deliverWorkspaceNotifications(manager, {
    eventId, actorId, workspaceId: task.workspaceId, resourceType: 'task',
    resourceId: task.id, candidates: recipients, message: category => messages[category],
  });
}

export class DirectConversationResponseDto {
  id!: string;
  otherUserId!: string;
  otherUsername?: string;
  unreadCount?: number;
  lastMessageAt!: Date | null;
  createdAt!: Date;
}


export class DirectConversationResponseDto {
  id!: string;
  otherUserId!: string;
  lastMessageAt!: Date | null;
  createdAt!: Date;
}
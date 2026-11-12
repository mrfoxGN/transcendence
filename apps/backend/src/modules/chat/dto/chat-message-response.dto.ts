export class ChatMessageResponseDto {
  id!: string;
  workspaceId!: string;
  senderId!: string | null;
  content!: string;
  createdAt!: Date;
}

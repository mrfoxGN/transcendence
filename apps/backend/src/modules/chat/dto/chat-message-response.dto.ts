export class ChatMessageResponseDto {
  id!: string;
  workspaceId!: string;
  senderId!: string | null;
  content!: string;
  createdAt!: Date;
  reply?: { id: string; senderId: string | null; preview: string; unavailable: boolean };
  attachmentName?: string;
}

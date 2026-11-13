export class DirectMessageResponseDto {
  id!: string;
  conversationId!: string;
  senderId!: string;
  content!: string;
  createdAt!: Date;
  reply?: { id: string; senderId: string | null; preview: string; unavailable: boolean };
  attachmentName?: string;
}

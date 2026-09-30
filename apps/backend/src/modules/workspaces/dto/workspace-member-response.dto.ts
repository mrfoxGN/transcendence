export class WorkspaceMemberResponseDto {
  membershipId!: string;
  userId!: string;
  username!: string;
  avatarUrl!: string | null;
  joinedAt!: Date;
  isOwner!: boolean;
}

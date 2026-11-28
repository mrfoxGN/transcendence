import { FriendshipStatus } from '../../../database/enums/database.enums';

export class FriendUserResponseDto {
  id!: string;
  username!: string;
  avatarUrl!: string | null;
}

export class FriendshipResponseDto {
  id!: string;
  otherUser!: FriendUserResponseDto;
  requestedById!: string;
  status!: FriendshipStatus;
  requestedAt!: Date;
  respondedAt!: Date | null;
}

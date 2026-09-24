import { AppRole, UserStatus } from '../../../database/enums/database.enums';

export class UserResponseDto {
  id!: string; // UUID, not number
  username!: string;
  email!: string;
  avatarUrl!: string | null;
  appRole!: AppRole; // actual entity field
  status!: UserStatus; // actual entity field
  createdAt!: Date;
  updatedAt!: Date;
}

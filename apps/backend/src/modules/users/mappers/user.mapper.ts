import { User } from '../entities/user.entity';
import { UserResponseDto } from '../dto/user-response.dto';

export class UserMapper {
  static toResponse(user: User): UserResponseDto {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      emailVerified: user.verifiedEmail === user.email,
      isTwoFactorEnabled: user.isTwoFactorEnabled ?? false,
      avatarUrl: user.avatarUrl,
      theme: user.theme,
      notificationBadge: user.notificationBadge,
      appRole: user.appRole,
      status: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
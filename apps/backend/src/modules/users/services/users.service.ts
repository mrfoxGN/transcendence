import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { access, mkdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { InjectRepository } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import { IsNull, QueryFailedError, Repository } from 'typeorm';

import { AppRole, UserStatus } from '../../../database/enums/database.enums';
import { CreateUserDto } from '../dto/create-user.dto';
import { UserResponseDto } from '../dto/user-response.dto';
import { User } from '../entities/user.entity';
import { UserMapper } from '../mappers/user.mapper';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { UnauthorizedException } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { LessThan, MoreThan } from 'typeorm';

function isDuplicateError(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }

  const driverError = error.driverError as {
    code?: string;
  };

  return driverError.code === 'ER_DUP_ENTRY';
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async findById(id: string): Promise<UserResponseDto> {
    const user = await this.usersRepository.findOneBy({
      id,
      deletedAt: IsNull(),
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return UserMapper.toResponse(user);
  }

  async findForAuth(
    id: string,
  ): Promise<{ user: UserResponseDto; tokenVersion: number }> {
    const user = await this.usersRepository.findOneBy({
      id,
      deletedAt: IsNull(),
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      user: UserMapper.toResponse(user),
      tokenVersion: user.tokenVersion,
    };
  }

  findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOneBy({
      email,
      deletedAt: IsNull(),
    });
  }

  findByUsername(username: string): Promise<User | null> {
    return this.usersRepository.findOneBy({
      username,
      deletedAt: IsNull(),
    });
  }

  async create(createUserDto: CreateUserDto): Promise<UserResponseDto> {
    // 1. Check username and email
    const existingUser = await this.usersRepository.findOne({
      where: [
        { username: createUserDto.username },
        { email: createUserDto.email },
      ],
    });

    if (existingUser) {
      throw new ConflictException('Username or email already exists');
    }

    // 2. Hash the password
    const passwordHash = await argon2.hash(createUserDto.password);

    // 3. Create the entity
    const now = new Date();

    const user = this.usersRepository.create({
      id: randomUUID(),
      username: createUserDto.username,
      email: createUserDto.email,
      passwordHash,
      avatarUrl: null,
      appRole: AppRole.USER,
      status: UserStatus.ACTIVE,
      lastSeenAt: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      verifiedEmail: null,
      emailVerifyCodeHash: null,
      emailVerifyExpiresAt: null,
      emailVerifyAttempts: 0,
    });

    // 4. Save safely
    try {
      const savedUser = await this.usersRepository.save(user);

      return UserMapper.toResponse(savedUser);
    } catch (error: unknown) {
      if (isDuplicateError(error)) {
        throw new ConflictException('Username or email already exists');
      }

      throw error;
    }
  }

  async updateProfile(
    id: string,
    dto: UpdateProfileDto,
  ): Promise<UserResponseDto> {
    if (
      dto.username === undefined &&
      dto.email === undefined &&
      dto.avatarUrl === undefined &&
      dto.avatarImage === undefined
    ) {
      throw new BadRequestException('No changes provided');
    }

    if (dto.username === null || dto.email === null) {
      throw new BadRequestException('Username and email cannot be null');
    }

    if (dto.avatarUrl !== undefined && dto.avatarImage !== undefined) {
      throw new BadRequestException(
        'Choose either an avatar URL or an avatar image',
      );
    }

    const user = await this.usersRepository.findOneBy({
      id,
      deletedAt: IsNull(),
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const changes: Partial<User> = {
      updatedAt: new Date(),
    };

    if (dto.username !== undefined && dto.username !== user.username) {
      if (await this.usersRepository.existsBy({ username: dto.username })) {
        throw new ConflictException('Username already exists');
      }

      changes.username = dto.username;
    }

    if (dto.email !== undefined && dto.email !== user.email) {
      if (await this.usersRepository.existsBy({ email: dto.email })) {
        throw new ConflictException('Email already exists');
      }

      changes.email = dto.email;
      changes.verifiedEmail = null;
      changes.emailVerifyCodeHash = null;
      changes.emailVerifyExpiresAt = null;
      changes.emailVerifyAttempts = 0;
    }

    if (dto.avatarUrl !== undefined) {
      changes.avatarUrl = dto.avatarUrl;
    }

    let newAvatarUrl: string | null = null;

    try {
      if (dto.avatarImage !== undefined) {
        newAvatarUrl = await this.saveAvatarImage(id, dto.avatarImage);
        changes.avatarUrl = newAvatarUrl;
      }

      const result = await this.usersRepository.update(
        { id, deletedAt: IsNull() },
        changes,
      );

      if (!result.affected) {
        throw new NotFoundException('User not found');
      }
    } catch (error: unknown) {
      if (newAvatarUrl) {
        await this.removeStoredAvatar(id, newAvatarUrl);
      }

      if (isDuplicateError(error)) {
        throw new ConflictException('Username or email already exists');
      }

      throw error;
    }

    if (changes.avatarUrl !== undefined && user.avatarUrl) {
      await this.removeStoredAvatar(id, user.avatarUrl);
    }

    return UserMapper.toResponse({ ...user, ...changes });
  }

  private async removeStoredAvatar(
    userId: string,
    avatarUrl: string,
  ): Promise<void> {
    const match =
      /^\/users\/([0-9a-f-]{36})\/avatar\/([0-9a-f-]{36})\.jpg$/i.exec(
        avatarUrl,
      );

    if (!match || match[1] !== userId) {
      return;
    }

    const absolutePath = join(
      process.cwd(),
      'storage',
      'avatars',
      userId,
      `${match[2]}.jpg`,
    );

    await unlink(absolutePath).catch(() => undefined);
  }

  async revokeTokens(id: string): Promise<void> {
    const result = await this.usersRepository.increment(
      { id, deletedAt: IsNull() },
      'tokenVersion',
      1,
    );

    if (!result.affected) {
      throw new NotFoundException('User not found');
    }
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.usersRepository.findOneBy({
      id: userId,
      status: UserStatus.ACTIVE,
      deletedAt: IsNull(),
    });

    if (!user) {
      throw new UnauthorizedException();
    }

    const passwordMatches = await argon2.verify(
      user.passwordHash,
      currentPassword,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    if (currentPassword === newPassword) {
      throw new BadRequestException('New password must be different');
    }

    const passwordHash = await argon2.hash(newPassword);

    const result = await this.usersRepository.update(
      {
        id: userId,
        passwordHash: user.passwordHash,
        status: UserStatus.ACTIVE,
        deletedAt: IsNull(),
      },
      {
        passwordHash,
        updatedAt: new Date(),
        tokenVersion: () => 'token_version + 1',
        emailVerifyCodeHash: null,
        emailVerifyExpiresAt: null,
        emailVerifyAttempts: 0,
      },
    );

    if (!result.affected) {
      throw new ConflictException(
        'Password changed during this request. Try again.',
      );
    }
  }

  async createEmailVerificationCode(
    userId: string,
  ): Promise<{ email: string; code: string } | null> {
    const user = await this.usersRepository.findOneBy({
      id: userId,
      deletedAt: IsNull(),
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      return null;
    }

    if (user.verifiedEmail === user.email) {
      return null;
    }

    const now = new Date();

    // Allow another request after one minute.
    if (
      user.emailVerifyExpiresAt &&
      user.emailVerifyExpiresAt.getTime() > now.getTime() + 9 * 60 * 1000
    ) {
      return null;
    }

    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const codeHash = await argon2.hash(code);

    const result = await this.usersRepository.update(
      {
        id: userId,
        email: user.email,
        emailVerifyCodeHash: user.emailVerifyCodeHash ?? IsNull(),
        deletedAt: IsNull(),
      },
      {
        emailVerifyCodeHash: codeHash,
        emailVerifyExpiresAt: new Date(now.getTime() + 10 * 60 * 1000),
        emailVerifyAttempts: 0,
      },
    );

    return result.affected ? { email: user.email, code } : null;
  }

  async confirmEmailVerification(userId: string, code: string): Promise<void> {
    const invalidCode = new BadRequestException(
      'Invalid or expired verification code',
    );

    const user = await this.usersRepository.findOneBy({
      id: userId,
      deletedAt: IsNull(),
    });
    const now = new Date();

    if (
      !user ||
      user.status !== UserStatus.ACTIVE ||
      !user.emailVerifyCodeHash ||
      !user.emailVerifyExpiresAt ||
      user.emailVerifyExpiresAt <= now ||
      user.emailVerifyAttempts >= 5
    ) {
      throw invalidCode;
    }

    const matches = await argon2.verify(user.emailVerifyCodeHash, code);

    if (!matches) {
      await this.usersRepository.increment(
        {
          id: userId,
          email: user.email,
          emailVerifyCodeHash: user.emailVerifyCodeHash,
          emailVerifyAttempts: LessThan(5),
          deletedAt: IsNull(),
        },
        'emailVerifyAttempts',
        1,
      );

      throw invalidCode;
    }

    const result = await this.usersRepository.update(
      {
        id: userId,
        email: user.email,
        emailVerifyCodeHash: user.emailVerifyCodeHash,
        emailVerifyExpiresAt: MoreThan(new Date()),
        emailVerifyAttempts: LessThan(5),
        deletedAt: IsNull(),
      },
      {
        verifiedEmail: user.email,
        emailVerifyCodeHash: null,
        emailVerifyExpiresAt: null,
        emailVerifyAttempts: 0,
        updatedAt: new Date(),
      },
    );

    if (!result.affected) {
      throw invalidCode;
    }
  }

  async createPasswordResetCode(email: string): Promise<string | null> {
    const user = await this.findByEmail(email);

    if (!user || user.status !== UserStatus.ACTIVE) {
      return null;
    }

    const now = new Date();

    // Do not send another code during the first minute.
    if (
      user.emailVerifyExpiresAt &&
      user.emailVerifyExpiresAt.getTime() > now.getTime() + 9 * 60 * 1000
    ) {
      return null;
    }

    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const codeHash = await argon2.hash(`password-reset:${code}`);

    const result = await this.usersRepository.update(
      {
        id: user.id,
        email,
        emailVerifyCodeHash: user.emailVerifyCodeHash ?? IsNull(),
        deletedAt: IsNull(),
      },
      {
        emailVerifyCodeHash: codeHash,
        emailVerifyExpiresAt: new Date(now.getTime() + 10 * 60 * 1000),
        emailVerifyAttempts: 0,
      },
    );

    return result.affected ? code : null;
  }

  async resetPasswordWithCode(
    email: string,
    code: string,
    newPassword: string,
  ): Promise<string> {
    const invalidCode = new BadRequestException(
      'Invalid or expired reset code',
    );

    const user = await this.findByEmail(email);

    if (
      !user ||
      user.status !== UserStatus.ACTIVE ||
      !user.emailVerifyCodeHash ||
      !user.emailVerifyExpiresAt ||
      user.emailVerifyExpiresAt <= new Date() ||
      user.emailVerifyAttempts >= 5
    ) {
      throw invalidCode;
    }

    const matches = await argon2.verify(
      user.emailVerifyCodeHash,
      `password-reset:${code}`,
    );

    if (!matches) {
      await this.usersRepository.increment(
        {
          id: user.id,
          email,
          emailVerifyCodeHash: user.emailVerifyCodeHash,
          emailVerifyAttempts: LessThan(5),
          deletedAt: IsNull(),
        },
        'emailVerifyAttempts',
        1,
      );

      throw invalidCode;
    }

    const passwordHash = await argon2.hash(newPassword);

    const result = await this.usersRepository.update(
      {
        id: user.id,
        email,
        status: UserStatus.ACTIVE,
        emailVerifyCodeHash: user.emailVerifyCodeHash,
        emailVerifyExpiresAt: MoreThan(new Date()),
        emailVerifyAttempts: LessThan(5),
        deletedAt: IsNull(),
      },
      {
        passwordHash,
        tokenVersion: () => 'token_version + 1',
        emailVerifyCodeHash: null,
        emailVerifyExpiresAt: null,
        emailVerifyAttempts: 0,
        updatedAt: new Date(),
      },
    );

    if (!result.affected) {
      throw invalidCode;
    }

    return user.id;
  }

  private async saveAvatarImage(
    userId: string,
    avatarImage: string,
  ): Promise<string> {
    const prefix = 'data:image/jpeg;base64,';

    if (!avatarImage.startsWith(prefix)) {
      throw new BadRequestException('Avatar must be a JPEG image');
    }

    const encoded = avatarImage.slice(prefix.length);

    if (!encoded || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
      throw new BadRequestException('Invalid avatar image');
    }

    const image = Buffer.from(encoded, 'base64');

    if (
      image.length < 5 ||
      image.length > 24 * 1024 ||
      image.toString('base64') !== encoded ||
      image[0] !== 0xff ||
      image[1] !== 0xd8 ||
      image[2] !== 0xff ||
      image[image.length - 2] !== 0xff ||
      image[image.length - 1] !== 0xd9
    ) {
      throw new BadRequestException('Invalid avatar image');
    }

    const fileName = `${randomUUID()}.jpg`;
    const directory = join(process.cwd(), 'storage', 'avatars', userId);
    const absolutePath = join(directory, fileName);

    try {
      await mkdir(directory, { recursive: true });
      await writeFile(absolutePath, image);
    } catch {
      await unlink(absolutePath).catch(() => undefined);
      throw new ServiceUnavailableException('Could not save avatar image');
    }

    return `/users/${userId}/avatar/${fileName}`;
  }

  async getAvatarPath(userId: string, avatarId: string): Promise<string> {
    const user = await this.usersRepository.findOneBy({
      id: userId,
      deletedAt: IsNull(),
    });

    const avatarUrl = `/users/${userId}/avatar/${avatarId}.jpg`;

    if (!user || user.avatarUrl !== avatarUrl) {
      throw new NotFoundException('Avatar not found');
    }

    const absolutePath = join(
      process.cwd(),
      'storage',
      'avatars',
      userId,
      `${avatarId}.jpg`,
    );

    try {
      await access(absolutePath);
    } catch {
      throw new NotFoundException('Avatar file not found');
    }

    return absolutePath;
  }
}

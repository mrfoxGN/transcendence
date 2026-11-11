import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

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
    const user = await this.usersRepository.findOneBy({
      id,
      deletedAt: IsNull(),
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

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

    const changes: Partial<User> = { updatedAt: new Date() };
    if (dto.avatarImage !== undefined) {
      if (dto.avatarUrl !== undefined) throw new BadRequestException('Choose either an image or a URL.');
      const encoded = dto.avatarImage.slice('data:image/jpeg;base64,'.length);
      const image = Buffer.from(encoded, 'base64');
      if (!dto.avatarImage.startsWith('data:image/jpeg;base64,')
        || image.length < 5 || image.length > 24 * 1024 || image.toString('base64') !== encoded
        || image[0] !== 0xff || image[1] !== 0xd8 || image[2] !== 0xff
        || image[image.length - 2] !== 0xff || image[image.length - 1] !== 0xd9) {
        throw new BadRequestException('Choose a valid avatar image.');
      }
      changes.avatarUrl = dto.avatarImage;
    }
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
      Object.assign(changes, {
        email: dto.email, verifiedEmail: null, emailVerifyDigest: null, emailVerifyExpiresAt: null,
        passwordResetDigest: null, passwordResetExpiresAt: null,
      });
    }

    if (dto.avatarUrl !== undefined) {
      changes.avatarUrl = dto.avatarUrl;
    }

    try {
      const updated = await this.usersRepository.update({ id, deletedAt: IsNull() }, changes);
      if (!updated.affected) throw new NotFoundException('User not found');
      return UserMapper.toResponse({ ...user, ...changes });
    } catch (error: unknown) {
      if (isDuplicateError(error)) {
        throw new ConflictException('Username or email already exists');
      }
      throw error;
    }
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
}

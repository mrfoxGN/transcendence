import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import {
  IsNull,
  QueryFailedError,
  Repository,
} from 'typeorm';

import {
  AppRole,
  UserStatus,
} from '../../../database/enums/database.enums';
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

  async create(
    createUserDto: CreateUserDto,
  ): Promise<UserResponseDto> {
    // 1. Check username and email
    const existingUser = await this.usersRepository.findOne({
      where: [
        { username: createUserDto.username },
        { email: createUserDto.email },
      ],
    });

    if (existingUser) {
      throw new ConflictException(
        'Username or email already exists',
      );
    }

    // 2. Hash the password
    const passwordHash = await argon2.hash(
      createUserDto.password,
    );

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
        throw new ConflictException(
          'Username or email already exists',
        );
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
      dto.avatarUrl === undefined
    ) {
      throw new BadRequestException('No changes provided');
    }

    if (dto.username === null || dto.email === null) {
      throw new BadRequestException('Username and email cannot be null');
    }

    if (dto.username !== undefined && dto.username !== user.username) {
      if (await this.usersRepository.existsBy({ username: dto.username })) {
        throw new ConflictException('Username already exists');
      }
      user.username = dto.username;
    }

    if (dto.email !== undefined && dto.email !== user.email) {
      if (await this.usersRepository.existsBy({ email: dto.email })) {
        throw new ConflictException('Email already exists');
      }
      user.email = dto.email;
    }

    if (dto.avatarUrl !== undefined) {
      user.avatarUrl = dto.avatarUrl;
    }

    user.updatedAt = new Date();

    try {
      return UserMapper.toResponse(await this.usersRepository.save(user));
    } catch (error: unknown) {
      if (isDuplicateError(error)) {
        throw new ConflictException('Username or email already exists');
      }
      throw error;
    }
  }
}
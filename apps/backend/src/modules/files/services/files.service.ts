import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { access, mkdir, unlink, writeFile } from 'fs/promises';
import { join } from 'path';
import { IsNull, Repository } from 'typeorm';

import { TasksService } from '../../tasks/services/tasks.service';
import { WorkspacesService } from '../../workspaces/services/workspaces.service';
import { ListWorkspaceFilesDto } from '../dto/list-workspace-files.dto';
import { UploadWorkspaceFileDto } from '../dto/upload-workspace-file.dto';
import { WorkspaceFileResponseDto } from '../dto/workspace-file-response.dto';
import { WorkspaceFile } from '../entities/workspace-file.entity';

@Injectable()
export class FilesService {
  private readonly storageRoot = join(
    process.cwd(),
    'storage',
    'workspace-files',
  );

  constructor(
    @InjectRepository(WorkspaceFile)
    private readonly workspaceFilesRepository: Repository<WorkspaceFile>,

    private readonly workspacesService: WorkspacesService,

    private readonly tasksService: TasksService,
  ) {}

  async upload(
    workspaceId: string,
    userId: string,
    file: Express.Multer.File | undefined,
    dto: UploadWorkspaceFileDto,
  ): Promise<WorkspaceFileResponseDto> {
    await this.workspacesService.findOneForUser(workspaceId, userId);

    if (!file) {
      throw new BadRequestException('File is required');
    }

    if (dto.taskId) {
      const task = await this.tasksService.findById(dto.taskId, userId);

      if (task.workspaceId !== workspaceId) {
        throw new BadRequestException(
          'Task does not belong to this workspace',
        );
      }
    }

    const id = randomUUID();
    const storageFileName = randomUUID();

    const workspaceStorageDirectory = join(
      this.storageRoot,
      workspaceId,
    );

    const storageKey = `${workspaceId}/${storageFileName}`;

    const absolutePath = join(
      workspaceStorageDirectory,
      storageFileName,
    );

    await mkdir(workspaceStorageDirectory, {
      recursive: true,
    });

    await writeFile(absolutePath, file.buffer);

    const workspaceFile = this.workspaceFilesRepository.create({
      id,
      workspaceId,
      uploaderId: userId,
      taskId: dto.taskId ?? null,
      originalName: file.originalname,
      displayName: dto.displayName?.trim() || file.originalname,
      storageKey,
      mimeType: file.mimetype || null,
      sizeBytes: String(file.size),
      createdAt: new Date(),
      deletedAt: null,
    });

    try {
      const savedFile =
        await this.workspaceFilesRepository.save(workspaceFile);

      return this.toResponse(savedFile);
    } catch (error) {
      await unlink(absolutePath).catch(() => undefined);
      throw error;
    }
  }

  async findAll(
    workspaceId: string,
    userId: string,
    query: ListWorkspaceFilesDto,
  ): Promise<WorkspaceFileResponseDto[]> {
    await this.workspacesService.findOneForUser(
      workspaceId,
      userId,
    );

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const files = await this.workspaceFilesRepository.find({
      where: {
        workspaceId,
        deletedAt: IsNull(),
      },
      order: {
        createdAt: 'DESC',
        id: 'DESC',
      },
      skip,
      take: limit,
    });

    return files.map((file) => this.toResponse(file));
  }

  async findOne(
    workspaceId: string,
    fileId: string,
    userId: string,
  ): Promise<WorkspaceFileResponseDto> {
    await this.workspacesService.findOneForUser(
      workspaceId,
      userId,
    );

    const file = await this.workspaceFilesRepository.findOne({
      where: {
        id: fileId,
        workspaceId,
        deletedAt: IsNull(),
      },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    return this.toResponse(file);
  }

  async remove(
    workspaceId: string,
    fileId: string,
    userId: string,
  ): Promise<void> {
    const workspace =
      await this.workspacesService.findOneForUser(
        workspaceId,
        userId,
      );

    const file = await this.workspaceFilesRepository.findOne({
      where: {
        id: fileId,
        workspaceId,
        deletedAt: IsNull(),
      },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    if (
      file.uploaderId !== userId &&
      workspace.ownerId !== userId
    ) {
      throw new ForbiddenException(
        'Only the uploader or workspace owner can delete this file',
      );
    }

    file.deletedAt = new Date();

    await this.workspaceFilesRepository.save(file);

    const absolutePath = join(
      this.storageRoot,
      file.storageKey,
    );

    await unlink(absolutePath).catch(() => undefined);
  }

  async getDownloadInfo(
    workspaceId: string,
    fileId: string,
    userId: string,
  ): Promise<{
    absolutePath: string;
    originalName: string;
    mimeType: string | null;
    sizeBytes: string;
  }> {
    await this.workspacesService.findOneForUser(
      workspaceId,
      userId,
    );

    const file = await this.workspaceFilesRepository.findOne({
      where: {
        id: fileId,
        workspaceId,
        deletedAt: IsNull(),
      },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    const absolutePath = join(
      this.storageRoot,
      file.storageKey,
    );

    try {
      await access(absolutePath);
    } catch {
      throw new NotFoundException('Stored file not found');
    }

    return {
      absolutePath,
      originalName: file.originalName,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
    };
  }

  private toResponse(
    file: WorkspaceFile,
  ): WorkspaceFileResponseDto {
    return {
      id: file.id,
      workspaceId: file.workspaceId,
      uploaderId: file.uploaderId,
      taskId: file.taskId,
      originalName: file.originalName,
      displayName: file.displayName,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      createdAt: file.createdAt,
    };
  }
}

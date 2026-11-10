import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { access, mkdir, unlink, writeFile } from 'fs/promises';
import { join } from 'path';
import { IsNull, Raw, Repository } from 'typeorm';

import { ActivitiesService } from '../../activities/services/activities.service';
import { TasksService } from '../../tasks/services/tasks.service';
import { WorkspacesService } from '../../workspaces/services/workspaces.service';
import { ListWorkspaceFilesDto } from '../dto/list-workspace-files.dto';
import { UploadWorkspaceFileDto } from '../dto/upload-workspace-file.dto';
import { WorkspaceFileResponseDto } from '../dto/workspace-file-response.dto';
import { WorkspaceFile } from '../entities/workspace-file.entity';

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

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

    private readonly activitiesService: ActivitiesService,
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
        throw new BadRequestException('Task does not belong to this workspace');
      }
    }

    const id = randomUUID();
    const storageFileName = randomUUID();

    const workspaceStorageDirectory = join(this.storageRoot, workspaceId);

    const storageKey = `${workspaceId}/${storageFileName}`;

    const absolutePath = join(workspaceStorageDirectory, storageFileName);

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

    let savedFile: WorkspaceFile;

    try {
      savedFile = await this.workspaceFilesRepository.save(workspaceFile);
    } catch (error) {
      await unlink(absolutePath).catch(() => undefined);
      throw error;
    }

    try {
      await this.activitiesService.create({
        workspaceId,
        actorUserId: userId,
        actionType: 'FILE_UPLOADED',
        resourceType: 'workspace_file',
        resourceId: savedFile.id,
        metadata: {
          displayName: savedFile.displayName,
          originalName: savedFile.originalName,
          taskId: savedFile.taskId,
        },
      });
    } catch (error) {
      this.logger.error(
        `Could not create FILE_UPLOADED activity for file ${savedFile.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }

    return this.toResponse(savedFile);
  }

  async findAll(
    workspaceId: string,
    userId: string,
    query: ListWorkspaceFilesDto,
  ): Promise<WorkspaceFileResponseDto[]> {
    await this.workspacesService.findOneForUser(workspaceId, userId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const search = query.search?.trim().replace(/[!%_]/g, character => '!' + character);
    const files = await this.workspaceFilesRepository.find({
      where: {
        workspaceId,
        deletedAt: IsNull(),
        ...(search && {
          displayName: Raw(
            (column) => `${column} LIKE :search ESCAPE '!'`,
            { search: '%' + search + '%' },
          ),
        }),
      },
      order: {
        ...(query.sort === 'name' && { displayName: 'ASC' as const }),
        ...(query.sort === 'size' && { sizeBytes: 'DESC' as const }),
        createdAt: 'DESC',
        id: 'DESC',
      },
      skip,
      take: limit + (query.lookahead === '1' ? 1 : 0),
    });

    return files.map((file) => this.toResponse(file));
  }

  async findOne(
    workspaceId: string,
    fileId: string,
    userId: string,
  ): Promise<WorkspaceFileResponseDto> {
    await this.workspacesService.findOneForUser(workspaceId, userId);

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
    const workspace = await this.workspacesService.findOneForUser(
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

    if (file.uploaderId !== userId && workspace.ownerId !== userId) {
      throw new ForbiddenException(
        'Only the uploader or workspace owner can delete this file',
      );
    }

    const absolutePath = join(this.storageRoot, file.storageKey);

    // Delete the physical file before marking it as deleted.
    // If deletion fails, keep the database record active so
    // the user can retry the DELETE request.

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await unlink(absolutePath);
        break;
      } catch (error) {
        const code =
          error instanceof Error && 'code' in error
            ? String(error.code)
            : 'UNKNOWN';

        // The file was already removed.
        // We can safely continue with the database update.
        if (code === 'ENOENT') {
          this.logger.warn(`Physical file already missing for file ${file.id}`);
          break;
        }

        // Retry only transient filesystem errors.
        const retryable = code === 'EBUSY' || code === 'EAGAIN';

        if (retryable && attempt < 3) {
          this.logger.warn(
            `Retrying physical deletion for file ${file.id} ` +
              `(attempt ${attempt}, code ${code})`,
          );

          await new Promise<void>((resolve) =>
            setTimeout(resolve, attempt * 200),
          );

          continue;
        }

        // Never silently ignore filesystem errors.
        this.logger.error(
          `Physical deletion failed for file ${file.id} ` +
            `in workspace ${workspaceId} (code: ${code})`,
          error instanceof Error ? error.stack : String(error),
        );

        throw new ServiceUnavailableException(
          'Unable to delete file from storage. Please retry.',
        );
      }
    }

    // Only mark the file as deleted after physical cleanup.
    file.deletedAt = new Date();

    await this.workspaceFilesRepository.save(file);

    try {
      await this.activitiesService.create({
        workspaceId,
        actorUserId: userId,
        actionType: 'FILE_DELETED',
        resourceType: 'workspace_file',
        resourceId: file.id,
        metadata: {
          displayName: file.displayName,
          originalName: file.originalName,
          taskId: file.taskId,
        },
      });
    } catch (error) {
      this.logger.error(
        `Could not create FILE_DELETED activity for file ${file.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
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
    await this.workspacesService.findOneForUser(workspaceId, userId);

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

    const absolutePath = join(this.storageRoot, file.storageKey);

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

  private toResponse(file: WorkspaceFile): WorkspaceFileResponseDto {
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

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { createReadStream } from 'fs';
import type { Request, Response } from 'express';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ListWorkspaceFilesDto } from '../dto/list-workspace-files.dto';
import { UploadWorkspaceFileDto } from '../dto/upload-workspace-file.dto';
import { WorkspaceFileResponseDto } from '../dto/workspace-file-response.dto';
import { FilesService } from '../services/files.service';

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
  };
}

@Controller('workspaces/:workspaceId/files')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FilesController {
  constructor(
    private readonly filesService: FilesService,
  ) {}

  @Post()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
    }),
  )
  async upload(
    @Param('workspaceId', ParseUUIDPipe)
    workspaceId: string,

    @Req()
    request: AuthenticatedRequest,

    @UploadedFile()
    file: Express.Multer.File | undefined,

    @Body()
    dto: UploadWorkspaceFileDto,
  ): Promise<WorkspaceFileResponseDto> {
    return this.filesService.upload(
      workspaceId,
      request.user.id,
      file,
      dto,
    );
  }

  @Get()
  async findAll(
    @Param('workspaceId', ParseUUIDPipe)
    workspaceId: string,

    @Req()
    request: AuthenticatedRequest,

    @Query()
    query: ListWorkspaceFilesDto,
  ): Promise<WorkspaceFileResponseDto[]> {
    return this.filesService.findAll(
      workspaceId,
      request.user.id,
      query,
    );
  }
  @Delete(':fileId')
  @HttpCode(204)
  async remove(
    @Param('workspaceId', ParseUUIDPipe)
    workspaceId: string,

    @Param('fileId', ParseUUIDPipe)
    fileId: string,

    @Req()
    request: AuthenticatedRequest,
  ): Promise<void> {
    await this.filesService.remove(
      workspaceId,
      fileId,
      request.user.id,
    );
  }

  @Get(':fileId/download')
  async download(
    @Param('workspaceId', ParseUUIDPipe)
    workspaceId: string,

    @Param('fileId', ParseUUIDPipe)
    fileId: string,

    @Req()
    request: AuthenticatedRequest,

    @Res({ passthrough: true })
    response: Response,
  ): Promise<StreamableFile> {
    const file = await this.filesService.getDownloadInfo(
      workspaceId,
      fileId,
      request.user.id,
    );

    response.setHeader(
      'Content-Type',
      file.mimeType ?? 'application/octet-stream',
    );

    response.setHeader(
      'Content-Length',
      file.sizeBytes,
    );

    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.originalName.replace(/["\\]/g, '_')}"`,
    );

    return new StreamableFile(
      createReadStream(file.absolutePath),
    );
  }

  @Get(':fileId')
  async findOne(
    @Param('workspaceId', ParseUUIDPipe)
    workspaceId: string,

    @Param('fileId', ParseUUIDPipe)
    fileId: string,

    @Req()
    request: AuthenticatedRequest,
  ): Promise<WorkspaceFileResponseDto> {
    return this.filesService.findOne(
      workspaceId,
      fileId,
      request.user.id,
    );
  }

}

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { WorkspaceFile } from '../entities/workspace-file.entity';

@Injectable()
export class FilesService {
  constructor(
    @InjectRepository(WorkspaceFile)
    private readonly workspaceFilesRepository: Repository<WorkspaceFile>,
  ) {}
}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { FilesController } from './controllers/files.controller';
import { WorkspaceFile } from './entities/workspace-file.entity';
import { FilesService } from './services/files.service';

@Module({
  imports: [TypeOrmModule.forFeature([WorkspaceFile])],
  controllers: [FilesController],
  providers: [FilesService],
  exports: [FilesService],
})
export class FilesModule {}

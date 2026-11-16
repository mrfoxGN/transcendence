import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class ListWorkspaceFilesDto {
  @IsOptional()
  @IsUUID()
  uploaderId?: string;

  @IsOptional()
  @IsIn(['image', 'document', 'text', 'other'])
  kind?: 'image' | 'document' | 'text' | 'other';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsIn(['recent', 'name', 'size'])
  sort?: 'recent' | 'name' | 'size';

  @IsOptional()
  @IsIn(['1'])
  lookahead?: '1';
}

import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, MaxLength, Max, Min } from 'class-validator';

export class ListChatMessagesDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @IsOptional()
  @IsUUID()
  before?: string;

  @IsOptional()
  @IsUUID()
  after?: string;

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
}

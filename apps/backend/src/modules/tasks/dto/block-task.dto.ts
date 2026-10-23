import { IsNotEmpty, IsString } from 'class-validator';

export class BlockTaskDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;
}
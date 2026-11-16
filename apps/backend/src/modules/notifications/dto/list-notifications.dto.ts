import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

import { notificationCategories } from '../notification-events';

export class ListNotificationsDto {
  @IsOptional()
  @IsIn(Object.keys(notificationCategories))
  category?: keyof typeof notificationCategories;

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
  @Transform(({ value }) => {
    const input: unknown = value;

    if (input === 'true') {
      return true;
    }

    if (input === 'false') {
      return false;
    }

    return input;
  })
  @IsBoolean()
  unreadOnly?: boolean;
}

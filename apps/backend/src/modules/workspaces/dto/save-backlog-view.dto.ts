import { Type } from 'class-transformer';
import { IsBoolean, IsDefined, IsIn, IsString, Length, Matches, MaxLength, ValidateNested } from 'class-validator';

class BacklogFacetsDto {
  @Matches(/^(?:|unassigned|[0-9a-f-]{36})$/i)
  assignee!: string;

  @IsIn(['', 'None', 'Low', 'Medium', 'High', 'Urgent'])
  priority!: string;

  @IsIn(['', 'Next 7 days', 'Overdue', 'No due date'])
  due!: string;
}

class BacklogViewDto {
  @IsIn(['backlog', 'all', 'review'])
  scope!: 'backlog' | 'all' | 'review';

  @IsIn(['manual', 'priority', 'due'])
  sort!: 'manual' | 'priority' | 'due';

  @IsBoolean()
  mine!: boolean;

  @IsBoolean()
  blocked!: boolean;

  @IsString()
  @MaxLength(200)
  search!: string;

  @IsDefined()
  @ValidateNested()
  @Type(() => BacklogFacetsDto)
  facets!: BacklogFacetsDto;
}

export class SaveBacklogViewDto {
  @IsString()
  @Length(1, 60)
  name!: string;

  @IsDefined()
  @ValidateNested()
  @Type(() => BacklogViewDto)
  view!: BacklogViewDto;
}

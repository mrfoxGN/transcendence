import { RepositoryVisibility } from '../../../database/enums/database.enums';

export class ConnectedRepositoryResponseDto {
  id!: string;
  workspaceId!: string;
  githubRepositoryId!: string;
  fullName!: string;
  repositoryUrl!: string;
  defaultBranch!: string;
  visibility!: RepositoryVisibility;
  createdAt!: Date;
}

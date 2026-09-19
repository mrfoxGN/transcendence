import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { GitHubInstallation } from '../entities/github-installation.entity';

@Injectable()
export class GitHubService {
  constructor(
    @InjectRepository(GitHubInstallation)
    private readonly installationsRepository: Repository<GitHubInstallation>,
  ) {}
}

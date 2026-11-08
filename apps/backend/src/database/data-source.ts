import 'reflect-metadata';
import { extname, join } from 'node:path';
import { DataSource } from 'typeorm';

// Use TypeScript in development and compiled JavaScript in production.
const extension = extname(__filename);

export const AppDataSource = new DataSource({
  type: 'mysql',

  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),

  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,

  synchronize: false,

  entities: [join(__dirname, '..', '**', `*.entity${extension}`)],
  migrations: [join(__dirname, 'migrations', `*${extension}`)],

  migrationsTableName: 'typeorm_migrations',
});

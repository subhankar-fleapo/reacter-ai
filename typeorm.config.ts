import { DataSource, DataSourceOptions } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

const hasDatabaseUrl = !!process.env.DATABASE_URL;

const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  url: process.env.DATABASE_URL,
  host: hasDatabaseUrl ? undefined : process.env.DATABASE_HOST,
  port: hasDatabaseUrl ? undefined : Number(process.env.DATABASE_PORT),
  username: hasDatabaseUrl ? undefined : process.env.DATABASE_USERNAME,
  password: hasDatabaseUrl ? undefined : process.env.DATABASE_PASSWORD,
  database: hasDatabaseUrl ? undefined : process.env.DATABASE_NAME,
  entities: ['src/data/entities/**/*.entity.ts'],
  migrations: ['src/data/migrations/[!index]*.ts'],
  namingStrategy: new SnakeNamingStrategy(),
  migrationsTableName: 'migrations',
  schema: 'reacter_ai',
  logging: false,
  uuidExtension: 'pgcrypto',
  migrationsTransactionMode: 'each',
  ...(process.env.DATABASE_CERTIFICATE_AUTHORITY && {
    ssl: {
      ca: process.env.DATABASE_CERTIFICATE_AUTHORITY,
    },
  }),
};

export default new DataSource(dataSourceOptions);

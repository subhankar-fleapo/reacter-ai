import { DataSource, DataSourceOptions } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT),
  username: process.env.DATABASE_USERNAME,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  entities: ['src/data/entities/**/*.entity.ts'],
  migrations: ['src/data/migrations/[!index]*.ts'],
  namingStrategy: new SnakeNamingStrategy(),
  migrationsTableName: 'reacter_migrations',
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

import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import * as entities from './entities';
import * as migrations from './migrations';
import * as repositories from './repositories';

@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.getOrThrow('DATABASE_HOST'),
        port: configService.getOrThrow('DATABASE_PORT'),
        username: configService.getOrThrow('DATABASE_USERNAME'),
        password: configService.getOrThrow('DATABASE_PASSWORD'),
        database: configService.getOrThrow('DATABASE_NAME'),
        entities,
        migrations,
        migrationsRun: !!configService.get('RUN_DB_MIGRATIONS_ON_START'),
        migrationsTransactionMode: 'each',
        migrationsTableName: 'reacter_migrations',
        namingStrategy: new SnakeNamingStrategy(),
        uuidExtension: 'pgcrypto',
        ...(configService.get('DATABASE_CERTIFICATE_AUTHORITY') && {
          ssl: {
            ca: configService.getOrThrow('DATABASE_CERTIFICATE_AUTHORITY'),
          },
        }),
      }),
    }),
  ],
  providers: Object.values(repositories),
  exports: Object.values(repositories),
})
export class DatabaseModule {}

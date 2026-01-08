import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import * as entities from './entities';
import * as migrations from './migrations';
import * as repositories from './repositories';
import { readFileSync } from 'fs';

@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const databaseUrl = configService.get<string>('DATABASE_URL');

        const baseConfig: TypeOrmModuleOptions = {
          type: 'postgres' as const,
          entities,
          migrations,
          migrationsRun: !!configService.get('RUN_DB_MIGRATIONS_ON_START'),
          migrationsTransactionMode: 'each' as const,
          migrationsTableName: 'migrations',
          schema: 'reacter_ai',
          namingStrategy: new SnakeNamingStrategy(),
          uuidExtension: 'pgcrypto',
          ssl: {
            ca: readFileSync('pg-ca.pem'),
          },
        };

        if (databaseUrl) {
          return {
            ...baseConfig,
            url: databaseUrl,
          } as TypeOrmModuleOptions;
        }

        return {
          ...baseConfig,
          host: configService.getOrThrow('DATABASE_HOST'),
          port: configService.getOrThrow('DATABASE_PORT'),
          username: configService.getOrThrow('DATABASE_USERNAME'),
          password: configService.getOrThrow('DATABASE_PASSWORD'),
          database: configService.getOrThrow('DATABASE_NAME'),
        } as TypeOrmModuleOptions;
      },
    }),
  ],
  providers: Object.values(repositories),
  exports: Object.values(repositories),
})
export class DatabaseModule {}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class UsersTimezoneOffset1768120000000 implements MigrationInterface {
  name = 'UsersTimezoneOffset1768120000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "reacter_ai"."users" ADD COLUMN "timezone_offset" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "reacter_ai"."users" DROP COLUMN "timezone_offset"`,
    );
  }
}

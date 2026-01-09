import { MigrationInterface, QueryRunner } from 'typeorm';

export class CalendarTables1767927896119 implements MigrationInterface {
  name = 'CalendarTables1767927896119';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "reacter_ai"."google_tokens" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "email" character varying NOT NULL, "access_token" character varying NOT NULL, "refresh_token" character varying NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "user_id" uuid, CONSTRAINT "UQ_0b8af5bfa32c5920b5164bbfedf" UNIQUE ("email"), CONSTRAINT "REL_7a54af4fdf32ebc6ae6b887e0b" UNIQUE ("user_id"), CONSTRAINT "PK_fd3fd334c893412fc1605e1feac" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "reacter_ai"."google_tokens" ADD CONSTRAINT "FK_7a54af4fdf32ebc6ae6b887e0b2" FOREIGN KEY ("user_id") REFERENCES "reacter_ai"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "reacter_ai"."google_tokens" DROP CONSTRAINT "FK_7a54af4fdf32ebc6ae6b887e0b2"`,
    );
    await queryRunner.query(`DROP TABLE "reacter_ai"."google_tokens"`);
  }
}

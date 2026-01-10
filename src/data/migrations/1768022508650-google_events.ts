import { MigrationInterface, QueryRunner } from 'typeorm';

export class GoogleEvents1768022508650 implements MigrationInterface {
  name = 'GoogleEvents1768022508650';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "reacter_ai"."calendar_events" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL, "google_event_id" character varying NOT NULL, "title" character varying NOT NULL, "description" text, "start_date_time" TIMESTAMP WITH TIME ZONE NOT NULL, "end_date_time" TIMESTAMP WITH TIME ZONE NOT NULL, "calendar_id" character varying NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_a366b35b1824f50000e2978ce6b" UNIQUE ("google_event_id"), CONSTRAINT "PK_faf5391d232322a87cdd1c6f30c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "reacter_ai"."calendar_events" ADD CONSTRAINT "FK_7f9a3d7f6217b99b6b2431887df" FOREIGN KEY ("user_id") REFERENCES "reacter_ai"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "reacter_ai"."calendar_events" DROP CONSTRAINT "FK_7f9a3d7f6217b99b6b2431887df"`,
    );
    await queryRunner.query(`DROP TABLE "reacter_ai"."calendar_events"`);
  }
}

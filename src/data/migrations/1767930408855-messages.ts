import { MigrationInterface, QueryRunner } from 'typeorm';

export class Messages1767930408855 implements MigrationInterface {
  name = 'Messages1767930408855';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "reacter_ai"."messages" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "prompt" text NOT NULL, "response" text, "user_id" uuid NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_18325f38ae6de43878487eff986" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "reacter_ai"."messages" ADD CONSTRAINT "FK_830a3c1d92614d1495418c46736" FOREIGN KEY ("user_id") REFERENCES "reacter_ai"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "reacter_ai"."messages" DROP CONSTRAINT "FK_830a3c1d92614d1495418c46736"`,
    );
    await queryRunner.query(`DROP TABLE "reacter_ai"."messages"`);
  }
}

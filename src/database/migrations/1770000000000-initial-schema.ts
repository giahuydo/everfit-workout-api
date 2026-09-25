import type { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1770000000000 implements MigrationInterface {
  name = 'InitialSchema1770000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE TABLE "exercises" ("id" uuid NOT NULL, "name" varchar(120) NOT NULL, "normalized_name" varchar(120) COLLATE "C" NOT NULL, "muscle_group" varchar(80), "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(), "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(), CONSTRAINT "pk_exercises" PRIMARY KEY ("id"), CONSTRAINT "uq_exercises_normalized_name" UNIQUE ("normalized_name"), CONSTRAINT "ck_exercises_normalized_name_not_blank" CHECK (char_length(btrim("normalized_name")) > 0))',
    );
    await queryRunner.query(
      'CREATE TABLE "workout_entries" ("id" uuid NOT NULL, "user_id" varchar(128) NOT NULL, "exercise_id" uuid NOT NULL, "workout_date" date NOT NULL, "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(), CONSTRAINT "pk_workout_entries" PRIMARY KEY ("id"), CONSTRAINT "ck_workout_entries_user_id_not_blank" CHECK (char_length(btrim("user_id")) > 0), CONSTRAINT "fk_workout_entries_exercise" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE RESTRICT)',
    );
    await queryRunner.query(
      'CREATE TABLE "workout_sets" ("id" uuid NOT NULL, "workout_entry_id" uuid NOT NULL, "set_order" smallint NOT NULL, "reps" integer NOT NULL, "original_weight" numeric(12,3) NOT NULL, "original_unit" varchar(8) NOT NULL, "weight_kg" numeric(15,6) NOT NULL, CONSTRAINT "pk_workout_sets" PRIMARY KEY ("id"), CONSTRAINT "uq_workout_sets_entry_order" UNIQUE ("workout_entry_id", "set_order"), CONSTRAINT "ck_workout_sets_set_order_positive" CHECK ("set_order" > 0), CONSTRAINT "ck_workout_sets_reps_range" CHECK ("reps" BETWEEN 1 AND 10000), CONSTRAINT "ck_workout_sets_original_weight_range" CHECK ("original_weight" BETWEEN 0 AND 100000), CONSTRAINT "ck_workout_sets_weight_kg_nonnegative" CHECK ("weight_kg" >= 0), CONSTRAINT "ck_workout_sets_original_unit_not_blank" CHECK (char_length(btrim("original_unit")) > 0), CONSTRAINT "fk_workout_sets_entry" FOREIGN KEY ("workout_entry_id") REFERENCES "workout_entries"("id") ON DELETE CASCADE)',
    );
    await queryRunner.query(
      'CREATE INDEX "idx_workout_entries_user_cursor" ON "workout_entries" ("user_id", "workout_date" DESC, "created_at" DESC, "id" DESC)',
    );
    await queryRunner.query(
      'CREATE INDEX "idx_workout_entries_user_exercise_date" ON "workout_entries" ("user_id", "exercise_id", "workout_date" DESC, "created_at" DESC, "id" DESC)',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "workout_sets"');
    await queryRunner.query('DROP TABLE "workout_entries"');
    await queryRunner.query('DROP TABLE "exercises"');
  }
}

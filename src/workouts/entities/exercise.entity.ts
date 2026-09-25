import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('exercises')
@Index('uq_exercises_normalized_name', ['normalizedName'], { unique: true })
export class Exercise {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ name: 'normalized_name', type: 'varchar', length: 120, collation: 'C' })
  normalizedName!: string;

  @Column({ name: 'muscle_group', type: 'varchar', length: 80, nullable: true })
  muscleGroup!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz', precision: 3 })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz', precision: 3 })
  updatedAt!: Date;
}

import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { Exercise } from './exercise.entity.js';
import { WorkoutSet } from './workout-set.entity.js';

@Entity('workout_entries')
@Index('idx_workout_entries_user_cursor', ['userId', 'workoutDate', 'createdAt', 'id'])
@Index('idx_workout_entries_user_exercise_date', ['userId', 'exerciseId', 'workoutDate', 'createdAt', 'id'])
export class WorkoutEntry {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'varchar', length: 128 })
  userId!: string;

  @Column({ name: 'exercise_id', type: 'uuid' })
  exerciseId!: string;

  @ManyToOne(() => Exercise, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'exercise_id' })
  exercise!: Relation<Exercise>;

  @Column({ name: 'workout_date', type: 'date' })
  workoutDate!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz', precision: 3 })
  createdAt!: Date;

  @OneToMany(() => WorkoutSet, (set) => set.workoutEntry)
  sets!: Relation<WorkoutSet[]>;
}

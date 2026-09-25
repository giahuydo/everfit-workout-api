import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { WorkoutEntry } from './workout-entry.entity.js';

@Entity('workout_sets')
@Index('uq_workout_sets_entry_order', ['workoutEntryId', 'setOrder'], { unique: true })
export class WorkoutSet {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'workout_entry_id', type: 'uuid' })
  workoutEntryId!: string;

  @ManyToOne(() => WorkoutEntry, (entry) => entry.sets, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workout_entry_id' })
  workoutEntry!: Relation<WorkoutEntry>;

  @Column({ name: 'set_order', type: 'smallint' })
  setOrder!: number;

  @Column({ type: 'integer' })
  reps!: number;

  @Column({ name: 'original_weight', type: 'numeric', precision: 12, scale: 3 })
  originalWeight!: string;

  @Column({ name: 'original_unit', type: 'varchar', length: 8 })
  originalUnit!: string;

  @Column({ name: 'weight_kg', type: 'numeric', precision: 15, scale: 6 })
  weightKg!: string;
}

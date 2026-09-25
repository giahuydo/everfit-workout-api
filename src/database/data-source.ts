import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Exercise } from '../workouts/entities/exercise.entity.js';
import { WorkoutEntry } from '../workouts/entities/workout-entry.entity.js';
import { WorkoutSet } from '../workouts/entities/workout-set.entity.js';
import { InitialSchema1770000000000 } from './migrations/1770000000000-initial-schema.js';

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT ?? '55432'),
  username: process.env.DB_USER ?? 'everfit',
  password: process.env.DB_PASSWORD ?? 'everfit',
  database: process.env.DB_NAME ?? 'everfit',
  synchronize: false,
  entities: [Exercise, WorkoutEntry, WorkoutSet],
  migrations: [InitialSchema1770000000000],
});

import 'dotenv/config';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Exercise } from '../workouts/entities/exercise.entity.js';
import { WorkoutEntry } from '../workouts/entities/workout-entry.entity.js';
import { WorkoutSet } from '../workouts/entities/workout-set.entity.js';
import { validateEnvironment } from '../config/environment.js';
import { InitialSchema1770000000000 } from './migrations/1770000000000-initial-schema.js';

const env = validateEnvironment(process.env);

export default new DataSource({
  type: 'postgres',
  host: String(env.DB_HOST),
  port: Number(env.DB_PORT),
  username: String(env.DB_USER),
  password: String(env.DB_PASSWORD),
  database: String(env.DB_NAME),
  synchronize: false,
  entities: [Exercise, WorkoutEntry, WorkoutSet],
  migrations: [InitialSchema1770000000000],
});

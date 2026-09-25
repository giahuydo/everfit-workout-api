import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerModule } from 'nestjs-pino';
import { HealthController } from './health.controller.js';
import { UnitsModule } from './units/units.module.js';
import { WorkoutsModule } from './workouts/workouts.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRoot({ pinoHttp: { autoLogging: true, redact: ['req.headers.authorization'] } }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        host: config.get<string>('DB_HOST') ?? '127.0.0.1',
        port: Number(config.get<string>('DB_PORT') ?? '55432'),
        username: config.get<string>('DB_USER') ?? 'everfit',
        password: config.get<string>('DB_PASSWORD') ?? 'everfit',
        database: config.get<string>('DB_NAME') ?? 'everfit',
        autoLoadEntities: true,
        synchronize: (config.get<string>('DB_SYNCHRONIZE') ?? 'true') === 'true',
        logging: false,
      }),
    }),
    UnitsModule,
    WorkoutsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}

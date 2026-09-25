import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import { validateEnvironment } from './config/environment.js';
import { HealthController } from './health.controller.js';
import { HttpExceptionFilter } from './common/http-exception.filter.js';
import { UnitsModule } from './units/units.module.js';
import { WorkoutsModule } from './workouts/workouts.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    LoggerModule.forRoot({
      pinoHttp: {
        autoLogging: true,
        genReqId: (request, response) => {
          const supplied = request.headers['x-request-id'];
          const requestId = typeof supplied === 'string' && /^[A-Za-z0-9._-]{1,128}$/.test(supplied) ? supplied : randomUUID();
          response.setHeader('x-request-id', requestId);
          return requestId;
        },
        customProps: (request) => ({ requestId: request.id }),
        redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers.set-cookie', 'req.body.password', 'req.body.token'],
      },
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        host: config.get<string>('DB_HOST') ?? '127.0.0.1',
        port: config.get<number>('DB_PORT') ?? 55432,
        username: config.get<string>('DB_USER') ?? 'everfit',
        password: config.get<string>('DB_PASSWORD') ?? 'everfit',
        database: config.get<string>('DB_NAME') ?? 'everfit',
        autoLoadEntities: true,
        synchronize: config.get<boolean>('DB_SYNCHRONIZE') ?? false,
        logging: false,
        extra: {
          max: config.get<number>('DB_POOL_MAX') ?? 10,
          connectionTimeoutMillis: config.get<number>('DB_CONNECTION_TIMEOUT_MS') ?? 5_000,
          idleTimeoutMillis: config.get<number>('DB_IDLE_TIMEOUT_MS') ?? 30_000,
          statement_timeout: config.get<number>('DB_STATEMENT_TIMEOUT_MS') ?? 15_000,
          query_timeout: config.get<number>('DB_STATEMENT_TIMEOUT_MS') ?? 15_000,
          lock_timeout: config.get<number>('DB_LOCK_TIMEOUT_MS') ?? 5_000,
          idle_in_transaction_session_timeout: config.get<number>('DB_IDLE_TRANSACTION_TIMEOUT_MS') ?? 30_000,
        },
      }),
    }),
    UnitsModule,
    WorkoutsModule,
  ],
  controllers: [HealthController],
  providers: [HttpExceptionFilter],
})
export class AppModule {}

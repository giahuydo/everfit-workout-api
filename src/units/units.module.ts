import { Global, Module } from '@nestjs/common';
import { UnitsService } from './units.service.js';

@Global()
@Module({ providers: [UnitsService], exports: [UnitsService] })
export class UnitsModule {}

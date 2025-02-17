// src/log/log.module.ts

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LogController } from './log.controller';
import { LogService } from './log.service';
import { InstanceLog } from './entities/instance-log.entity';
import { ExceptionEntity } from './entities/exception.entity';
import { InstanceConfigService } from './instance-config.service';

/**
 * LogModule:
 * - 로그 추출/분석 기능을 한 곳에 모아두는 Feature Module
 * - Controller, Service, Entity, 기타 Provider를 한 데 묶어서 관리
 */
@Module({
  imports: [
    // 이 모듈 안에서 사용할 엔티티들 등록
    TypeOrmModule.forFeature([InstanceLog, ExceptionEntity]),
  ],
  controllers: [LogController],
  providers: [LogService, InstanceConfigService],
  exports: [LogService, InstanceConfigService],
})
export class LogModule {}

// src/app.module.ts

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';

import { LogService } from './log/log.service';
import { LogController } from './log/log.controller';
import { ExceptionEntity } from './log/entities/exception.entity';
import { InstanceLog } from './log/entities/instance-log.entity';
import { LogModule } from './log/log.module';

@Module({
  imports: [
    // 1) 환경변수(.env) 로드
    ConfigModule.forRoot({
      isGlobal: true, // 모든 모듈에서 ConfigService를 사용할 수 있게 설정
    }),

    // 2) TypeORM 설정을 비동기 방식으로 (forRootAsync)
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: configService.get<number>('DB_PORT', 5432),
        username: configService.get<string>('DB_USER', 'postgres'),
        password: configService.get<string>('DB_PASS', ''),
        database: configService.get<string>('DB_NAME', 'postgres'),
        entities: [InstanceLog, ExceptionEntity],
        synchronize: configService.get<boolean>('DB_SYNC') ?? false,
        dropSchema: configService.get<boolean>('DB_DROP_SCHEMA') ?? false,
      }),
      inject: [ConfigService],
    }),

    // 3) 엔티티 별도 등록 (서비스에서 Repository 사용)
    TypeOrmModule.forFeature([InstanceLog, ExceptionEntity]),

    // 4) 로그 모듈
    LogModule,
  ],
  controllers: [AppController, LogController],
  providers: [AppService, LogService],
})
export class AppModule {}
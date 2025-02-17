// src/log/log.controller.ts
import { Controller, Get, Param, Post, Body, Query } from '@nestjs/common';
import { LogService } from './log.service';
import { In } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExceptionEntity } from './entities/exception.entity';
import { InstanceLog } from './entities/instance-log.entity';
import { InstanceConfigService } from './instance-config.service';

@Controller('logs')
export class LogController {
  constructor(
    private readonly logService: LogService,
    @InjectRepository(ExceptionEntity)
    private readonly exceptionRepository: Repository<ExceptionEntity>,
    @InjectRepository(InstanceLog)
    private readonly instanceLogRepository: Repository<InstanceLog>,
    private readonly instanceConfigService: InstanceConfigService,
  ) {}

  // 인스턴스 목록
  @Get('instances')
  getInstances(): string[] {
    return this.instanceConfigService.getAllInstanceIds();
  }

  // 로그 추출
  @Post('extract')
  async extractLog(@Body() body: { instanceId: string }) {
    await this.logService.extractAndStoreById(body.instanceId);
    return { message: `[${body.instanceId}] 로그 추출 완료` };
  }

  // 예외 목록
  @Get('exceptions')
  async getExceptions() {
    return this.exceptionRepository.find({
      take: 50,
      order: { id: 'DESC' },
    });
  }

  // 특정 예외 상세
  @Get('exceptions/:id')
  async getExceptionDetail(@Param('id') id: number) {
    const exception = await this.exceptionRepository.findOne({
      where: { id },
      relations: { log: true },
    });
    if (!exception) {
      throw new Error(`Exception not found: id=${id}`);
    }
    return exception;
  }

  // 이미 저장된 로그 목록 (최근 50건)
  @Get('instance-logs')
  async getInstanceLogs(@Query('instanceId') instanceId?: string) {
    const whereCondition = instanceId ? { instanceId } : {};
    return this.instanceLogRepository.find({
      where: whereCondition,
      order: { id: 'DESC' },
      take: 50,
    });
  }

  // 특정 로그 상세 + 예외 목록
  @Get('instance-logs/:id')
  async getInstanceLogDetail(@Param('id') id: number) {
    const log = await this.instanceLogRepository.findOne({
      where: { id },
      relations: { exceptions: true },
    });
    if (!log) {
      throw new Error(`InstanceLog not found: id=${id}`);
    }
    return log;
  }

  // 아래 2개는 프론트엔드가 요구하는:
  // GET /logs/extracted-dates/:instanceId
  // GET /logs/detail?instanceId=xxx&date=yyyymmdd
  @Get('extracted-dates/:instanceId')
  async getExtractedDates(@Param('instanceId') instanceId: string) {
    // 인스턴스별로 instance_logs 테이블에서 날짜 수집
    const logs = await this.instanceLogRepository.find({
      where: { instanceId },
      order: { logDate: 'DESC' },
    });
    // logDate -> YYYYMMDD 문자열로 변환 후 중복 제거
    const dateStrs = logs.map((log) => {
      console.log('log', log);
      const date = new Date(log.logDate);
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}${m}${d}`;
    });
    const unique = Array.from(new Set(dateStrs));
    return unique;
  }

  @Get('detail')
  async getLogDetail(
    @Query('instanceId') instanceId: string,
    @Query('date') date: string,
  ) {
    // DB에서 (instanceId, logDate == date)인 첫 로그
    const logs = await this.instanceLogRepository.find({
      where: { instanceId },
      order: { id: 'DESC' },
    });

    // findOneBy 조건 등으로 바꿀 수도 있지만,
    // 여기서는 단순 예시로 date 변환 비교
    const found = logs.find((log) => {
      const logDate = new Date(log.logDate);
      const y = logDate.getFullYear();
      const m = String(logDate.getMonth() + 1).padStart(2, '0');
      const d = String(logDate.getDate()).padStart(2, '0');
      const ymd = `${y}${m}${d}`;
      return ymd === date; // queryDate와 비교
    });

    if (!found) {
      return {
        id: 0,
        instanceId,
        date,
        content: '(내용 없음)',
      };
    }

    return {
      id: found.id,
      instanceId: found.instanceId,
      date,
    };
  }

  // src/log/log.controller.ts (예시)
  @Get('exceptions-count')
  async getExceptionsCount(
    @Query('instanceId') instanceId: string,
    @Query('date') date: string,
  ): Promise<number> {
    // 1) instance_logs에서 (instanceId, logDate=해당 date)인 로그들의 id 목록
    const logs = await this.instanceLogRepository.find({
      where: { instanceId },
    });

    // date -> YYYY-MM-DD 변환
    const target =
      date.slice(0, 4) + '-' + date.slice(4, 6) + '-' + date.slice(6, 8);

    const logIds = logs
      .filter((l) => {
        // l.logDate는 Date 객체라면, YYYY-MM-DD 문자열로 만들어서 비교
        const logDate = new Date(l.logDate);
        const y = logDate.getFullYear();
        const m = String(logDate.getMonth() + 1).padStart(2, '0');
        const d = String(logDate.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}` === target;
      })
      .map((l) => l.id);

    if (logIds.length === 0) {
      return 0;
    }

    // 2) exceptions 테이블에서 log_id IN (...) 에 해당하는 건수
    const count = await this.exceptionRepository.count({
      where: { log: { id: In(logIds) } },
    });
    return count;
  }

  @Get('exceptions-date')
  async getExceptionsByDate(
    @Query('instanceId') instanceId: string,
    @Query('date') date: string,
  ): Promise<ExceptionEntity[]> {
    // 1) instance_logs에서 (instanceId, logDate=해당 date)인 로그 목록
    //    date는 "20250217" 형식이므로, DB의 logDate(YYYY-MM-DD)와 비교
    const logs = await this.instanceLogRepository.find({
      where: { instanceId },
      relations: { exceptions: true }, // 예외 함께 로딩
    });

    // date -> YYYY-MM-DD 변환
    const target =
      date.slice(0, 4) + '-' + date.slice(4, 6) + '-' + date.slice(6, 8);

    // 해당 날짜 로그들의 id
    const matchingLogIds = logs
      .filter((log) => {
        const logDate = new Date(log.logDate);
        const y = logDate.getFullYear();
        const m = String(logDate.getMonth() + 1).padStart(2, '0');
        const d = String(logDate.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}` === target;
      })
      .map((log) => log.id);

    if (matchingLogIds.length === 0) {
      return [];
    }

    // 2) 예외 테이블에서 log_id가 matchingLogIds 중 하나인 것들
    return this.exceptionRepository.find({
      where: { log: { id: In(matchingLogIds) } },
      order: { id: 'ASC' },
    });
  }
}

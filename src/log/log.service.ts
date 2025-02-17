// src/log/log.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { Client, ConnectConfig } from 'ssh2';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as zlib from 'zlib';
import * as readline from 'readline';
import { InstanceLog } from './entities/instance-log.entity';
import { ExceptionEntity } from './entities/exception.entity';
import { InstanceConfigService } from './instance-config.service';
import { getTodayString } from './date-utils';

@Injectable()
export class LogService {
  private readonly logger = new Logger(LogService.name);

  constructor(
    private readonly instanceConfigService: InstanceConfigService,
    @InjectRepository(InstanceLog)
    private readonly instanceLogRepository: Repository<InstanceLog>,
    @InjectRepository(ExceptionEntity)
    private readonly exceptionRepository: Repository<ExceptionEntity>,
  ) {}

  /**
   * 인스턴스 ID를 받아, SSH로 로그 gz 파일 다운로드 후 파싱하여 DB에 저장
   */
  async extractAndStoreById(instanceId: string): Promise<void> {
    const config = this.instanceConfigService.getInstanceConfigById(instanceId);
    if (!config) {
      throw new Error(`존재하지 않는 instanceId: ${instanceId}`);
    }

    const remoteFile = `${config.baseLogPath}-${getTodayString()}.gz`;
    const localFile = `/tmp/${instanceId}-${getTodayString()}.gz`;

    const conn = new Client();
    const connectionConfig: ConnectConfig = {
      host: config.host,
      port: 22,
      username: config.username,
      password: config.password,
    };

    return new Promise<void>((resolve, reject) => {
      conn.on('ready', () => {
        this.logger.log(`SSH 연결 성공: ${config.host}`);
        conn.sftp((err, sftp) => {
          if (err) {
            conn.end();
            return reject(err);
          }

          this.logger.log(
            `Downloading remote file: ${remoteFile} -> ${localFile}`,
          );
          sftp.fastGet(remoteFile, localFile, {}, (downloadErr) => {
            conn.end();
            if (downloadErr) {
              return reject(downloadErr);
            }

            (async () => {
              try {
                this.logger.log(`Download complete: ${localFile}`);
                await this.parseLocalGzFile(instanceId, localFile);
                this.logger.log(
                  `인스턴스 ${instanceId} 파싱 완료. 예외 DB 저장 완료.`,
                );
                fs.unlinkSync(localFile);
                resolve();
              } catch (parseErr) {
                reject(new Error(String(parseErr)));
              }
            })().catch((e) => reject(new Error(String(e))));
          });
        });
      });

      conn.on('error', (connErr) => {
        reject(connErr);
      });

      conn.connect(connectionConfig);
    });
  }

  /**
   * 로컬 gz 파일을 해제 후, 라인 단위로 예외 정보만 파싱하여 DB 저장
   * 전체 로그를 누적하지 않으므로 메모리 사용량을 줄임.
   */
  private async parseLocalGzFile(
    instanceId: string,
    localGz: string,
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const readStream = fs.createReadStream(localGz);
      const gunzipStream = zlib.createGunzip();
      const decompressedStream = readStream.pipe(gunzipStream);
      const rl = readline.createInterface({ input: decompressedStream });

      let lineNo = 0;
      const previousLines: string[] = [];

      // 예외 정보 수집
      const exceptions: {
        instanceId: string;
        lineNo: number;
        preLines: string;
        exceptionMessage: string;
        stackTrace: string[];
      }[] = [];

      let currentException: null | {
        instanceId: string;
        lineNo: number;
        preLines: string;
        exceptionMessage: string;
        stackTrace: string[];
      } = null;

      const stackTraceRegex = /^\s*(at\s+.*|Caused by:.*)/;

      rl.on('line', (line) => {
        lineNo++;
        // fullLog 누적 대신, 여기서는 예외 파싱만 수행

        previousLines.push(line);
        if (previousLines.length > 10) {
          previousLines.shift();
        }

        if (currentException) {
          if (stackTraceRegex.test(line)) {
            currentException.stackTrace.push(line);
            return;
          } else {
            exceptions.push({ ...currentException });
            currentException = null;
          }
        }

        if (line.includes('Exception')) {
          const preLines = previousLines.slice(0, previousLines.length - 1);
          currentException = {
            instanceId,
            lineNo,
            preLines: preLines.join('\n'),
            exceptionMessage: line,
            stackTrace: [],
          };
        }
      });

      rl.on('close', () => {
        (async () => {
          try {
            if (currentException) {
              exceptions.push({ ...currentException });
            }
            // 전체 로그 내용은 저장하지 않고, DB에는 예외 정보만 저장합니다.
            const instanceLog = this.instanceLogRepository.create({
              instanceId,
              logDate: new Date(),
            });
            const savedLog = await this.instanceLogRepository.save(instanceLog);

            const exceptionEntities = exceptions.map((exc) =>
              this.exceptionRepository.create({
                log: savedLog,
                instanceId: exc.instanceId,
                lineNo: exc.lineNo,
                preLines: exc.preLines,
                exceptionMessage: exc.exceptionMessage,
                stackTrace: exc.stackTrace.join('\n'),
              }),
            );
            await this.exceptionRepository.save(exceptionEntities);

            this.logger.log(
              `인스턴스 ${instanceId} - ${lineNo}줄 처리, 예외 ${exceptions.length}건 저장.`,
            );
            resolve();
          } catch (dbErr) {
            reject(new Error(String(dbErr)));
          }
        })().catch((e) => reject(new Error(String(e))));
      });

      rl.on('error', (streamErr) => {
        reject(new Error(String(streamErr)));
      });
    });
  }
}

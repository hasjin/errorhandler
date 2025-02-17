// src/log/instance-config.service.ts
import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export interface InstanceConfig {
  instanceId: string;
  host: string;
  username: string;
  password: string;
  baseLogPath: string;
}

@Injectable()
export class InstanceConfigService {
  private instanceList: InstanceConfig[] = [];

  constructor() {
    this.loadInstancesFile();
  }

  private loadInstancesFile() {
    const filePath = path.join(__dirname, '../../instances.json');
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      this.instanceList = JSON.parse(raw) as InstanceConfig[];
    } catch (error) {
      throw new Error(`instances.json 로드 실패: ${error}`);
    }
  }

  getAllInstanceIds(): string[] {
    return this.instanceList.map((inst) => inst.instanceId);
  }

  getInstanceConfigById(id: string): InstanceConfig | undefined {
    return this.instanceList.find((inst) => inst.instanceId === id);
  }
}

# NestJS - Tomcat Exception 조회 시스템 (Backend)

이 프로젝트는 **NestJS**, **TypeORM**, **PostgreSQL**을 이용하여 EC2 인스턴스의 Tomcat 로그를 SSH로 가져오고,  
로그에서 발생한 예외를 파싱하여 DB에 저장하는 백엔드 애플리케이션입니다.

---

## 주요 기능

- **SSH 로그 추출**: EC2 인스턴스에 SSH로 접속, Tomcat 로그(.gz) 다운로드 및 해제
- **예외 파싱**: 로그에서 "Exception" 키워드를 기반으로 예외 정보 추출
- **DB 저장**: `InstanceLog`와 `ExceptionEntity` 엔티티로 로그/예외를 PostgreSQL에 저장
- **API 제공**: 인스턴스 목록, 로그 추출, 날짜별 로그/예외 조회, 예외 상세 등
- **캐싱**(선택): NestJS CacheModule을 사용하여 GET 요청 캐시 가능

---

## 설치 및 실행

1. **저장소 클론**

```bash
git clone https://github.com/errorhandler.git
cd errorhandler
```

2. **의존성 설치**

```bash
npm install
```

3. **환경 변수 설정**  
   프로젝트 루트에 `.env` 파일을 생성하고 다음과 같이 설정하세요:
   ```dotenv
   DB_HOST=localhost
   DB_PORT=5432
   DB_USER=myuser
   DB_PASS=mypassword
   DB_NAME=mydb
   ```
   필요 시 SSH 접속 관련 정보도 `.env`나 ConfigModule을 통해 주입할 수 있습니다.

4. **프로젝트 실행**

```bash
# 개발 모드
npm run start:dev

# 프로덕션 빌드 후 실행
npm run build
npm run start
```

---

## API 엔드포인트

- `GET /logs/instances`  
  - 인스턴스 목록 조회
- `POST /logs/extract`  
  - 특정 인스턴스 로그 추출(SSH) 및 DB 저장
- `GET /logs/extracted-dates/:instanceId`  
  - 해당 인스턴스의 로그 추출 날짜(YYYYMMDD) 목록 반환
- `GET /logs/exceptions-date?instanceId=xxx&date=yyyymmdd`  
  - 날짜별 예외 목록 조회
- `GET /logs/detail?instanceId=xxx&date=yyyymmdd`  
  - 특정 날짜 로그 상세 내용
- `GET /logs/instance-logs`  
  - 최근 50건의 `InstanceLog` 목록
- `GET /logs/instance-logs/:id`  
  - 특정 로그 상세(연관 예외 포함)
- `GET /logs/exceptions`  
  - 최근 50건의 `ExceptionEntity`
- `GET /logs/exceptions/:id`  
  - 특정 예외 상세 + 해당 로그 연관
- (옵션) `GET /logs/exceptions-count?instanceId=xxx&date=yyyymmdd`  
  - 특정 날짜 예외 건수 조회

---

## 캐시 설정 (옵션)

```typescript
import { CacheModule } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { CacheInterceptor } from '@nestjs/cache-manager';

@Module({
  imports: [
    CacheModule.register({
      ttl: 60, // 캐시 TTL (초)
      max: 100, // 최대 항목
    }),
    // ... 기타 모듈
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: CacheInterceptor,
    },
  ],
})
export class AppModule {}
```

---

## 라이선스

MIT License
# TimeCheck

> 회사 근무 내규를 코드로 옮긴 풀스택 근무시간 관리 웹앱

출퇴근 기록부터 일반근무·시간외근무 분리, 반차·연차·공지 반영, 주간 보고서 및 시간외 근무 보고서 생성까지 한 곳에서 처리합니다.  
모바일에서도 쓸 수 있도록 PWA로 구성했습니다.

<!-- 데모 URL이 있으면 아래 주석을 해제하세요 -->
<!-- **Live Demo:** https://your-subdomain.duckdns.org -->

---

## 주요 기능

- **출퇴근 기록** — 원클릭 출근/퇴근, 시각 수동 보정
- **근무시간 자동 계산** — 휴게시간, 연장근로, 야근(시간외 1형/2형) 반영
- **다양한 근무 유형** — 일반, 오전/오후 반차, 월차·연차, 공휴일
- **공지 출퇴근** — 회사 공지에 따른 출근 지연·조기 퇴근 시 목표 시간 자동 조정
- **주간 대시보드** — 주 40시간 기준 일별·주간 요약, 부족/초과 시간 표시
- **보고서 복사** — 주간 일반근무·야근 보고서를 클립보드 형식으로 생성
- **PWA** — 홈 화면 추가, 모바일 탭 UI

## 기술 스택

| 구분 | 기술 |
|------|------|
| Backend | Java 17, Spring Boot, Spring Security, Spring Session JDBC, MyBatis |
| Frontend | Vue 3, TypeScript, Vite, Pinia, Element Plus |
| Database | SQLite |
| 기타 | PWA (vite-plugin-pwa), REST API |

## 아키텍처

| 환경 | 구성 |
|------|------|
| 개발 | Vue (Vite) + Spring Boot 분리 실행, API는 Vite 프록시로 연동 |
| 운영 | Vue 빌드 결과를 Spring 정적 리소스에 포함, 단일 JAR로 서비스 |

```
[개발]  Browser → Vite → Spring Boot → SQLite
[운영]  Browser → Spring Boot JAR → SQLite
```

## 구현 포인트

- **도메인 규칙 분리** — `WorkPolicy`에 근무 내규(기준 8시간, 휴게, 야근 22시 기준 분리 등)를 상수·정책으로 모아 계산 로직과 분리
- **세션 기반 인증** — Spring Security + JDBC 세션으로 로그인 상태 유지
- **프론트/백 계산 일관성** — 대시보드 미리보기와 서버 저장 시 동일 규칙 적용
- **반응형 UI** — 데스크톱 테이블 뷰와 모바일 탭 레이아웃 분기

## 구축 및 실행

### 개발

```bash
# 백엔드 (포트 2406)
./mvnw spring-boot:run

# 프론트 (포트 5173, /api는 Spring으로 프록시)
cd frontend && npm install && npm run dev
```

### 운영 빌드

```bash
cd frontend && npm ci && npm run build:deploy && cd ..
./mvnw -DskipTests package
```

산출물: `target/ROOT.jar`

```bash
java -jar target/ROOT.jar
```

SQLite DB는 `./data/timecheck.db`에 생성됩니다.

## 스크린샷

<!-- docs/images/ 에 스크린샷을 추가한 뒤 아래 예시처럼 연결하세요 -->
<!--
![대시보드](docs/images/dashboard.png)
![모바일](docs/images/mobile.png)
-->

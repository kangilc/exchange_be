# e2e-tests

Playwright 기반의 거래소 프론트엔드 End-to-End (E2E) 테스트 프로젝트.

## 요구 사항

- Node.js 18 이상
- 사용자 프론트엔드(`frontend-user`)가 로컬(`http://localhost:5173`)에서 구동 중이어야 함

## 설치

```bash
npm install
npx playwright install
```

## 실행 명령어

- `npm run test`: 터미널 환경에서 헤드리스 모드로 전체 테스트 실행
- `npm run test:ui`: Playwright UI 모드로 테스트 실행 (브라우저에서 직접 시각적 확인 및 디버깅 가능)
- `npx playwright test tests/tick-size-validation.spec.ts`: 호가 단위 정책 가격 입력 제한 검증 테스트 개별 실행

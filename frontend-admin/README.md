# Exchange Admin Frontend

이 프로젝트는 Vite, React, TypeScript를 기반으로 구축된 거래소 관리 시스템의 프론트엔드 애플리케이션입니다.

## 📝 프로젝트 개요

본 프로젝트는 거래소의 사용자, 자산, 거래 내역 등을 효율적으로 관리하기 위한 관리자용 대시보드를 제공합니다. 사용자 친화적인 UI와 실시간 데이터 처리를 통해 관리자가 시스템을 원활하게 운영할 수 있도록 돕는 것을 목표로 합니다.

## 🛠️ 주요 기술 스택

- **Framework**: [React](https://react.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **State Management**: [Zustand](https://zustand-demo.pmnd.rs/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/guide/packages/lucide-react)

## 📂 프로젝트 구조

프로젝트의 소스 코드는 `src` 디렉토리 내에 다음과 같은 구조로 구성되어 있습니다.

```
src/
├── assets/         # 이미지, 폰트 등 정적 에셋
├── components/     # 재사용 가능한 UI 컴포넌트
│   ├── modals/     # 모달(팝업) 컴포넌트
│   └── tabs/       # 탭별 메인 뷰 컴포넌트
├── store/          # Zustand를 사용한 전역 상태 관리
├── types/          # 프로젝트 전반에서 사용되는 TypeScript 타입 정의
├── App.tsx         # 메인 애플리케이션 컴포넌트
└── main.tsx        # 애플리케이션 진입점
```

- **`components/`**: 기능적으로 독립적이고 재사용 가능한 컴포넌트를 관리합니다.
  - **`modals/`**: 사용자 등록, 정보 수정 등 특정 작업을 위한 모달 창 컴포넌트가 위치합니다.
  - **`tabs/`**: '사용자 관리', '거래 관리' 등 대시보드의 각 탭에 해당하는 메인 화면 컴포넌트가 위치합니다.
- **`store/`**: Zustand 스토어를 정의하여 애플리케이션의 전역 상태를 관리합니다. API 호출 및 데이터 관리 로직이 포함됩니다.
- **`types/`**: `User`, `Trade` 등 프로젝트 전반에서 공통으로 사용되는 데이터 모델의 타입을 정의하여 코드의 일관성과 안정성을 높입니다.

## 🚀 실행 방법

### 1. 의존성 설치

프로젝트 루트 디렉토리에서 다음 명령어를 실행하여 필요한 패키지를 설치합니다.

```bash
npm install
```

### 2. 개발 서버 실행

다음 명령어를 실행하여 Vite 개발 서버를 시작합니다.

```bash
npm run dev
```

서버가 실행되면 브라우저에서 `http://localhost:5173` (또는 터미널에 표시되는 다른 주소)으로 접속할 수 있습니다.

### 3. 프로덕션 빌드

다음 명령어를 실행하여 프로덕션용으로 프로젝트를 빌드합니다.

```bash
npm run build
```

빌드 결과물은 `dist` 디렉토리에 생성됩니다.

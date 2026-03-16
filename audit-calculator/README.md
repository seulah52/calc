# Audit & Settlement Calculator (회계사 전용)

Next.js + Tailwind CSS + TypeScript로 만든 **회계사 전용 "Audit & Settlement Calculator"** 입니다.

## 기능
- **메인 계산기 패드**: 기계식 키패드 느낌의 UI
- **우측 사이드바**: Digital Audit Trail(입력/수정/계산/설정 변경 로그를 타임스탬프와 함께 기록)
- **하단 탭**: `일반 계산` / `차대 대조` / `안분 정산` 모드 전환
- **Audit Log(수정 전/후)**: 백스페이스/부호변경/%/AC 등 값 수정 시 before/after 기록
- **VAT/Tax 모드**: 세율(%)에 따라 공급가액/부가세/합계를 즉시 분리 표시
- **복사 기능**: 결과값 클릭 시 클립보드 복사 (VAT 모드에서는 `공급가액\t부가세\t합계` 형식)

## 실행 방법 (Windows PowerShell)

프로젝트 폴더로 이동:

```bash
cd c:\Users\user\dev\calc\audit-calculator
```

의존성 설치:

```bash
npm install
```

개발 서버 실행:

```bash
npm run dev
```

브라우저에서 `http://localhost:3000` 접속

## 빌드/실행

```bash
npm run build
npm run start
```

## 주요 파일
- `src/app/page.tsx`: UI/상태/로그/복사 기능
- `src/lib/expr.ts`: `eval()` 없이 수식 평가(Shunting-yard 기반)

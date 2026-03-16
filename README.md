# Pastel Calculator

`@.cursor/rules/pastel-calculator.mdc` 규칙(파스텔 팔레트, 원형 버튼, Grid/Flex 레이아웃, `eval()` 미사용, 소수점 중복 방지, AC 리셋, `aria-label`)을 반영한 바닐라 JS 계산기입니다.

## 실행 방법 (Windows)

### 방법 1) 파일을 바로 열기 (가장 간단)
- `index.html`을 더블 클릭해서 브라우저로 엽니다.

### 방법 2) 로컬 서버로 열기 (권장)
브라우저의 보안 정책/캐시 문제를 피하려면 로컬 서버 실행을 권장합니다.

#### PowerShell (Python 설치되어 있을 때)
프로젝트 폴더에서:

```bash
python -m http.server 5173
```

이후 브라우저에서 `http://localhost:5173` 접속

#### PowerShell (Node.js 설치되어 있을 때)

```bash
npx serve .
```

터미널에 표시되는 로컬 주소로 접속

## 기능
- 숫자/연산자: `+`, `−`, `×`, `÷`
- `AC`: 전체 초기화(표시값 `0`)
- `.`: 한 숫자 입력 중 소수점 중복 입력 방지
- `±`: 부호 변경
- `%`: 현재 입력값을 100으로 나누기
- `⌫`: 한 글자 삭제
- 키보드 입력 지원: 숫자, `.`, `+ - * /`, `Enter(=)`, `Backspace`, `Esc(AC)`

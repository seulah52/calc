/* 변경 이유: eval 없이 안전한 수식 평가(파서)를 제공 */

export type EvalOk = { ok: true; value: number };
export type EvalErr = { ok: false; message: string };
export type EvalResult = EvalOk | EvalErr;

type Token =
  | { t: "num"; v: number }
  | { t: "op"; v: "+" | "-" | "*" | "/" }
  | { t: "lparen" }
  | { t: "rparen" };

function isDigit(ch: string) {
  return ch >= "0" && ch <= "9";
}

function tokenize(input: string): Token[] | EvalErr {
  const tokens: Token[] = [];
  let i = 0;

  const s = input.replace(/\s+/g, "");
  if (s.length === 0) return { ok: false, message: "빈 수식입니다." };

  while (i < s.length) {
    const ch = s[i];

    if (ch === "(") {
      tokens.push({ t: "lparen" });
      i += 1;
      continue;
    }
    if (ch === ")") {
      tokens.push({ t: "rparen" });
      i += 1;
      continue;
    }
    if (ch === "+" || ch === "*" || ch === "/") {
      tokens.push({ t: "op", v: ch });
      i += 1;
      continue;
    }

    if (ch === "-") {
      // 단항 마이너스 처리: 앞이 연산자/좌괄호/시작이면 숫자 부호로 간주
      const prev = tokens[tokens.length - 1];
      const isUnary = !prev || prev.t === "op" || prev.t === "lparen";
      if (isUnary) {
        let j = i + 1;
        let seenDot = false;
        if (j >= s.length) return { ok: false, message: "단항 - 뒤에 숫자가 필요합니다." };
        if (!(isDigit(s[j]) || s[j] === ".")) return { ok: false, message: "단항 - 뒤에 숫자가 필요합니다." };
        while (j < s.length && (isDigit(s[j]) || s[j] === ".")) {
          if (s[j] === ".") {
            if (seenDot) return { ok: false, message: "소수점이 중복되었습니다." };
            seenDot = true;
          }
          j += 1;
        }
        const numText = s.slice(i, j);
        const v = Number(numText);
        if (!Number.isFinite(v)) return { ok: false, message: "숫자 형식이 올바르지 않습니다." };
        tokens.push({ t: "num", v });
        i = j;
        continue;
      }
      tokens.push({ t: "op", v: "-" });
      i += 1;
      continue;
    }

    if (isDigit(ch) || ch === ".") {
      let j = i;
      let seenDot = false;
      while (j < s.length && (isDigit(s[j]) || s[j] === ".")) {
        if (s[j] === ".") {
          if (seenDot) return { ok: false, message: "소수점이 중복되었습니다." };
          seenDot = true;
        }
        j += 1;
      }
      const numText = s.slice(i, j);
      const v = Number(numText);
      if (!Number.isFinite(v)) return { ok: false, message: "숫자 형식이 올바르지 않습니다." };
      tokens.push({ t: "num", v });
      i = j;
      continue;
    }

    return { ok: false, message: `허용되지 않는 문자: ${ch}` };
  }

  return tokens;
}

function precedence(op: "+" | "-" | "*" | "/") {
  return op === "*" || op === "/" ? 2 : 1;
}

function toRpn(tokens: Token[]): Token[] | EvalErr {
  const out: Token[] = [];
  const ops: Token[] = [];

  for (const tok of tokens) {
    if (tok.t === "num") {
      out.push(tok);
      continue;
    }
    if (tok.t === "op") {
      while (ops.length > 0) {
        const top = ops[ops.length - 1];
        if (top.t === "op" && precedence(top.v) >= precedence(tok.v)) {
          out.push(ops.pop() as Token);
          continue;
        }
        break;
      }
      ops.push(tok);
      continue;
    }
    if (tok.t === "lparen") {
      ops.push(tok);
      continue;
    }
    if (tok.t === "rparen") {
      let found = false;
      while (ops.length > 0) {
        const top = ops.pop() as Token;
        if (top.t === "lparen") {
          found = true;
          break;
        }
        out.push(top);
      }
      if (!found) return { ok: false, message: "괄호가 올바르게 닫히지 않았습니다." };
    }
  }

  while (ops.length > 0) {
    const top = ops.pop() as Token;
    if (top.t === "lparen") return { ok: false, message: "괄호가 올바르게 닫히지 않았습니다." };
    out.push(top);
  }
  return out;
}

function evalRpn(tokens: Token[]): EvalResult {
  const stack: number[] = [];

  for (const tok of tokens) {
    if (tok.t === "num") {
      stack.push(tok.v);
      continue;
    }
    if (tok.t === "op") {
      const b = stack.pop();
      const a = stack.pop();
      if (a === undefined || b === undefined) return { ok: false, message: "수식이 올바르지 않습니다." };
      let v = 0;
      switch (tok.v) {
        case "+":
          v = a + b;
          break;
        case "-":
          v = a - b;
          break;
        case "*":
          v = a * b;
          break;
        case "/":
          if (b === 0) return { ok: false, message: "0으로 나눌 수 없습니다." };
          v = a / b;
          break;
      }
      if (!Number.isFinite(v)) return { ok: false, message: "계산 결과가 유효하지 않습니다." };
      stack.push(v);
    }
  }

  if (stack.length !== 1) return { ok: false, message: "수식이 올바르지 않습니다." };
  return { ok: true, value: stack[0] };
}

export function evalExpression(input: string): EvalResult {
  const tokens = tokenize(input);
  if ("ok" in tokens && tokens.ok === false) return tokens;
  const rpn = toRpn(tokens as Token[]);
  if ("ok" in rpn && rpn.ok === false) return rpn;
  return evalRpn(rpn as Token[]);
}


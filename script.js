/* 변경 이유: eval 없이 안전한 계산 로직과 UI 이벤트를 구현 */

const displayEl = document.querySelector("[data-display]");
const expressionEl = document.querySelector("[data-expression]");
const keysEl = document.querySelector(".keys");

if (!(displayEl instanceof HTMLElement) || !(expressionEl instanceof HTMLElement) || !(keysEl instanceof HTMLElement)) {
  throw new Error("필수 DOM 요소를 찾지 못했습니다. index.html의 data-attributes를 확인하세요.");
}

const MAX_LEN = 18;

/** @type {{ accumulator: number | null, operator: string | null, input: string, lastKey: "digit"|"decimal"|"operator"|"equals"|"action" }} */
const state = {
  accumulator: null,
  operator: null,
  input: "0",
  lastKey: "action",
};

function clampDisplayText(text) {
  if (text.length <= MAX_LEN) return text;
  return text.slice(0, MAX_LEN);
}

function formatNumber(n) {
  if (!Number.isFinite(n)) return "오류";
  const text = String(n);
  if (text.length <= MAX_LEN) return text;
  const compact = n.toPrecision(12);
  return clampDisplayText(compact.replace(/\.0+($|e)/, "$1"));
}

function applyOp(a, op, b) {
  switch (op) {
    case "+":
      return a + b;
    case "-":
      return a - b;
    case "*":
      return a * b;
    case "/":
      return b === 0 ? NaN : a / b;
    default:
      return NaN;
  }
}

function setDisplay(valueText) {
  displayEl.textContent = clampDisplayText(valueText);
}

function setExpression(text) {
  expressionEl.textContent = text;
}

function syncUI() {
  setDisplay(state.input);
  const accText = state.accumulator === null ? "" : formatNumber(state.accumulator);
  const opText = state.operator ?? "";
  const expr = [accText, opText].filter(Boolean).join(" ");
  setExpression(expr);
}

function hardReset() {
  state.accumulator = null;
  state.operator = null;
  state.input = "0";
  state.lastKey = "action";
  syncUI();
}

function toNumber(input) {
  const n = Number(input);
  return Number.isFinite(n) ? n : NaN;
}

function inputDigit(d) {
  if (state.input === "오류") hardReset();

  if (state.lastKey === "operator" || state.lastKey === "equals") {
    state.input = d;
  } else if (state.input === "0") {
    state.input = d;
  } else {
    if (state.input.replace("-", "").replace(".", "").length >= 15) return;
    state.input += d;
  }
  state.lastKey = "digit";
  syncUI();
}

function inputDecimal() {
  if (state.input === "오류") hardReset();

  if (state.lastKey === "operator" || state.lastKey === "equals") {
    state.input = "0.";
  } else if (!state.input.includes(".")) {
    state.input += ".";
  }
  state.lastKey = "decimal";
  syncUI();
}

function chooseOperator(nextOp) {
  if (state.input === "오류") hardReset();

  const current = toNumber(state.input);
  if (state.accumulator === null) {
    state.accumulator = current;
  } else if (state.operator && state.lastKey !== "operator" && state.lastKey !== "equals") {
    const result = applyOp(state.accumulator, state.operator, current);
    if (!Number.isFinite(result)) {
      state.input = "오류";
      state.accumulator = null;
      state.operator = null;
      state.lastKey = "operator";
      syncUI();
      return;
    }
    state.accumulator = result;
    state.input = formatNumber(result);
  }

  state.operator = nextOp;
  state.lastKey = "operator";
  syncUI();
}

function equals() {
  if (state.input === "오류") {
    hardReset();
    return;
  }
  if (state.accumulator === null || state.operator === null) {
    state.lastKey = "equals";
    syncUI();
    return;
  }

  const current = toNumber(state.input);
  const result = applyOp(state.accumulator, state.operator, current);
  if (!Number.isFinite(result)) {
    state.input = "오류";
    state.accumulator = null;
    state.operator = null;
    state.lastKey = "equals";
    syncUI();
    return;
  }

  state.input = formatNumber(result);
  state.accumulator = null;
  state.operator = null;
  state.lastKey = "equals";
  syncUI();
}

function toggleSign() {
  if (state.input === "오류") hardReset();

  if (state.input === "0") return;
  state.input = state.input.startsWith("-") ? state.input.slice(1) : `-${state.input}`;
  state.lastKey = "action";
  syncUI();
}

function percent() {
  if (state.input === "오류") hardReset();

  const n = toNumber(state.input);
  if (!Number.isFinite(n)) return;
  const result = n / 100;
  state.input = formatNumber(result);
  state.lastKey = "action";
  syncUI();
}

function backspace() {
  if (state.input === "오류") {
    hardReset();
    return;
  }

  if (state.lastKey === "operator" || state.lastKey === "equals") return;
  if (state.input.length <= 1 || (state.input.length === 2 && state.input.startsWith("-"))) {
    state.input = "0";
  } else {
    state.input = state.input.slice(0, -1);
    if (state.input === "-" || state.input === "-0") state.input = "0";
  }
  state.lastKey = "action";
  syncUI();
}

keysEl.addEventListener("click", (e) => {
  const target = e.target;
  if (!(target instanceof HTMLElement)) return;
  const btn = target.closest("button");
  if (!(btn instanceof HTMLButtonElement)) return;

  const action = btn.dataset.action;
  switch (action) {
    case "digit":
      inputDigit(btn.dataset.digit ?? "0");
      break;
    case "decimal":
      inputDecimal();
      break;
    case "operator":
      chooseOperator(btn.dataset.operator ?? "+");
      break;
    case "equals":
      equals();
      break;
    case "clear":
      hardReset();
      break;
    case "sign":
      toggleSign();
      break;
    case "percent":
      percent();
      break;
    case "backspace":
      backspace();
      break;
    default:
      break;
  }
});

window.addEventListener("keydown", (e) => {
  const { key } = e;
  if (key >= "0" && key <= "9") {
    e.preventDefault();
    inputDigit(key);
    return;
  }

  if (key === ".") {
    e.preventDefault();
    inputDecimal();
    return;
  }

  if (key === "+" || key === "-" || key === "*" || key === "/") {
    e.preventDefault();
    chooseOperator(key);
    return;
  }

  if (key === "Enter" || key === "=") {
    e.preventDefault();
    equals();
    return;
  }

  if (key === "Backspace") {
    e.preventDefault();
    backspace();
    return;
  }

  if (key === "Escape") {
    e.preventDefault();
    hardReset();
  }
});

hardReset();

"use client";

// 변경 이유: 회계사 전용 계산기 UI 레이아웃(키패드/증적/모드 탭)과 복사/페이로드 기능을 구성

import { MouseEvent, useMemo, useState } from "react";
import {
  CheckCircle,
  ClipboardCopy,
  FileClock,
  Percent,
  Receipt,
  RotateCcw,
  SeparatorHorizontal,
} from "lucide-react";
import { evalExpression } from "@/lib/expr";

type Mode = "general" | "debitCredit" | "allocation";

type AuditEntry =
  | {
      id: string;
      at: number;
      kind: "expression";
      mode: Mode;
      expression: string;
      result: string;
      note?: string;
    }
  | {
      id: string;
      at: number;
      kind: "edit";
      mode: Mode;
      label: string;
      before: string;
      after: string;
      note?: string;
    }
  | {
      id: string;
      at: number;
      kind: "setting";
      label: string;
      value: string;
      note?: string;
    };

type TaxSnapshot = {
  enabled: boolean;
  rate: number;
  supply: number | null;
  vat: number | null;
  gross: number | null;
};

type DebitCreditSnapshot = {
  debit: string;
  credit: string;
  diff: number | null;
};

type AllocationSnapshot = {
  total: string;
  startDate: string;
  endDate: string;
  includeStart: boolean;
};

type Payload = {
  generatedAt: string;
  mode: Mode;
  display: string;
  expression: string;
  tax: TaxSnapshot;
  debitCredit: DebitCreditSnapshot;
  allocation: AllocationSnapshot;
  audit: AuditEntry[];
};

function formatTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function modeLabel(mode: Mode) {
  switch (mode) {
    case "general":
      return "일반 계산";
    case "debitCredit":
      return "차대 대조";
    case "allocation":
      return "안분 정산";
  }
}

export default function Home() {
  const [mode, setMode] = useState<Mode>("general");
  const [audit, setAudit] = useState<AuditEntry[]>([]);

  const [taxEnabled, setTaxEnabled] = useState<boolean>(false);
  const [taxRate, setTaxRate] = useState<number>(10);

  const [display, setDisplay] = useState<string>("0");
  const [expression, setExpression] = useState<string>("");
  const [expressionPreview, setExpressionPreview] = useState<string>("");
  const [lastWasEquals, setLastWasEquals] = useState<boolean>(false);

  const [dcDebit, setDcDebit] = useState<string>("0");
  const [dcCredit, setDcCredit] = useState<string>("0");
  const [dcActive, setDcActive] = useState<"debit" | "credit">("debit");

  const [allocTotal, setAllocTotal] = useState<string>("0");
  const [allocStart, setAllocStart] = useState<string>("");
  const [allocEnd, setAllocEnd] = useState<string>("");
  const [allocIncludeStart, setAllocIncludeStart] = useState<boolean>(true);

  const headerTitle = useMemo(() => `Audit & Settlement Calculator`, []);

  function pushAudit(entry: AuditEntry) {
    setAudit((prev) => [entry, ...prev].slice(0, 200));
  }

  function toggleTax() {
    setTaxEnabled((v) => {
      const next = !v;
      pushAudit({
        id: uid(),
        at: Date.now(),
        kind: "setting",
        label: "VAT/Tax 모드",
        value: next ? "ON" : "OFF",
      });
      return next;
    });
  }

  function changeTaxRate(next: number) {
    const safe = Number.isFinite(next) ? Math.max(0, Math.min(100, next)) : 10;
    setTaxRate(safe);
    pushAudit({
      id: uid(),
      at: Date.now(),
      kind: "setting",
      label: "세율(%)",
      value: String(safe),
    });
  }

  function setDisplayWithAudit(next: string, label: string) {
    setDisplay((before) => {
      if (before !== next) {
        pushAudit({
          id: uid(),
          at: Date.now(),
          kind: "edit",
          mode,
          label,
          before,
          after: next,
        });
      }
      return next;
    });
  }

  function setDisplaySilently(next: string) {
    setDisplay(next);
  }

  function syncPreview(nextExpr: string) {
    setExpressionPreview(nextExpr);
  }

  function appendDigit(d: string) {
    if (mode === "general") {
      if (lastWasEquals) {
        pushAudit({
          id: uid(),
          at: Date.now(),
          kind: "edit",
          mode,
          label: "새 입력 시작",
          before: display,
          after: d,
        });
        setExpression("");
        syncPreview("");
        setDisplaySilently(d);
        setLastWasEquals(false);
        return;
      }

      setDisplay((prev) => {
        if (prev === "0") return d;
        if (prev === "오류") return d;
        if (prev.length >= 18) return prev;
        return prev + d;
      });
      return;
    }

    const appendTo = (prev: string) => {
      if (prev === "0") return d;
      if (prev === "오류") return d;
      if (prev.length >= 18) return prev;
      return prev + d;
    };

    if (mode === "debitCredit") {
      if (dcActive === "debit") setDcDebit((p) => appendTo(p));
      else setDcCredit((p) => appendTo(p));
    } else if (mode === "allocation") {
      setAllocTotal((p) => appendTo(p));
    }
  }

  function appendDecimal() {
    const appendDec = (prev: string) => {
      if (prev === "오류") return "0.";
      if (prev.includes(".")) return prev;
      return prev + ".";
    };

    if (mode === "general") {
      if (lastWasEquals) {
        pushAudit({
          id: uid(),
          at: Date.now(),
          kind: "edit",
          mode,
          label: "새 입력 시작",
          before: display,
          after: "0.",
        });
        setExpression("");
        syncPreview("");
        setDisplaySilently("0.");
        setLastWasEquals(false);
        return;
      }
      setDisplay((prev) => appendDec(prev));
      return;
    }

    if (mode === "debitCredit") {
      if (dcActive === "debit") setDcDebit((p) => appendDec(p));
      else setDcCredit((p) => appendDec(p));
    } else if (mode === "allocation") {
      setAllocTotal((p) => appendDec(p));
    }
  }

  function clearAll() {
    setExpression("");
    syncPreview("");
    setLastWasEquals(false);
    setDisplayWithAudit("0", "AC");
    setDcDebit("0");
    setDcCredit("0");
    setAllocTotal("0");
    setAllocStart("");
    setAllocEnd("");
    setAllocIncludeStart(true);
  }

  function backspace() {
    const applyBackspace = (before: string) => {
      if (before === "오류") {
        pushAudit({ id: uid(), at: Date.now(), kind: "edit", mode, label: "오류 해제", before, after: "0" });
        return "0";
      }
      if (before.length <= 1) {
        if (before !== "0") {
          pushAudit({ id: uid(), at: Date.now(), kind: "edit", mode, label: "백스페이스", before, after: "0" });
        }
        return "0";
      }
      const after = before.slice(0, -1);
      pushAudit({ id: uid(), at: Date.now(), kind: "edit", mode, label: "백스페이스", before, after });
      return after;
    };

    if (mode === "general") {
      setDisplay((before) => applyBackspace(before));
      return;
    }

    if (mode === "debitCredit") {
      if (dcActive === "debit") setDcDebit((b) => applyBackspace(b));
      else setDcCredit((b) => applyBackspace(b));
    } else if (mode === "allocation") {
      setAllocTotal((b) => applyBackspace(b));
    }
  }

  function toggleSign() {
    const applySign = (before: string) => {
      if (before === "0" || before === "오류") return before;
      const after = before.startsWith("-") ? before.slice(1) : `-${before}`;
      pushAudit({ id: uid(), at: Date.now(), kind: "edit", mode, label: "부호 변경", before, after });
      return after;
    };

    if (mode === "general") {
      setDisplay((before) => applySign(before));
      return;
    }
    if (mode === "debitCredit") {
      if (dcActive === "debit") setDcDebit((b) => applySign(b));
      else setDcCredit((b) => applySign(b));
    } else if (mode === "allocation") {
      setAllocTotal((b) => applySign(b));
    }
  }

  function applyPercent() {
    const applyPct = (before: string) => {
      const n = Number(before);
      if (!Number.isFinite(n)) return "오류";
      const after = String(n / 100);
      pushAudit({ id: uid(), at: Date.now(), kind: "edit", mode, label: "퍼센트", before, after });
      return after;
    };
    if (mode === "general") {
      setDisplay((before) => applyPct(before));
      return;
    }
    if (mode === "debitCredit") {
      if (dcActive === "debit") setDcDebit((b) => applyPct(b));
      else setDcCredit((b) => applyPct(b));
    } else if (mode === "allocation") {
      setAllocTotal((b) => applyPct(b));
    }
  }

  function computeAllocationDays():
    | { ok: true; yearDays: number; targetDays: number }
    | { ok: false; message: string } {
    if (!allocStart || !allocEnd) {
      return { ok: false, message: "시작일과 종료일을 모두 입력하세요." };
    }
    const start = new Date(allocStart);
    const end = new Date(allocEnd);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return { ok: false, message: "날짜 형식이 올바르지 않습니다." };
    }
    const startMid = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const endMid = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    const diffMs = endMid.getTime() - startMid.getTime();
    const baseDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const targetDays = allocIncludeStart ? baseDays + 1 : baseDays;
    if (targetDays <= 0) {
      return { ok: false, message: "종료일은 시작일 이후여야 합니다." };
    }
    const year = startMid.getFullYear();
    const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    const yearDays = isLeap ? 366 : 365;
    return { ok: true, yearDays, targetDays };
  }

  function pushOperator(op: "+" | "-" | "*" | "/") {
    if (mode !== "general") return;
    if (display === "오류") return;

    const current = display;
    const normalizedOp = op;

    const nextExprBase = (() => {
      if (lastWasEquals) {
        setLastWasEquals(false);
        return `${current}`;
      }
      if (expression.trim().length === 0) return `${current}`;
      return expression;
    })();

    const trimmed = nextExprBase.trim();
    const endsWithOp = /[+\-*/]$/.test(trimmed);
    const exprWithNumber = endsWithOp ? trimmed.replace(/[+\-*/]$/, "") : trimmed;
    const nextExpr = `${exprWithNumber}${exprWithNumber.length > 0 ? " " : ""}${normalizedOp}`;

    setExpression(nextExpr);
    syncPreview(nextExpr.replaceAll("*", "×").replaceAll("/", "÷"));
    setDisplaySilently("0");
  }

  function evaluateNow() {
    if (mode === "general") {
      if (display === "오류") return;

      const expr = (() => {
        const base = expression.trim().length === 0 ? "" : expression.trim();
        const candidate = base.length === 0 ? display : `${base} ${display}`;
        return candidate.trim();
      })();

      const res = evalExpression(expr);
      if (!res.ok) {
        setDisplayWithAudit("오류", `계산 실패: ${res.message}`);
        return;
      }

      const resultText = String(res.value);
      setDisplaySilently(resultText);
      setExpression("");
      syncPreview(expr.replaceAll("*", "×").replaceAll("/", "÷"));
      setLastWasEquals(true);
      pushAudit({
        id: uid(),
        at: Date.now(),
        kind: "expression",
        mode,
        expression: expr.replaceAll("*", "×").replaceAll("/", "÷"),
        result: resultText,
      });
      return;
    }

    if (mode === "debitCredit") {
      const debit = Number(dcDebit);
      const credit = Number(dcCredit);
      if (!Number.isFinite(debit) || !Number.isFinite(credit)) {
        setDisplayWithAudit("오류", "차대 대조 입력값 오류");
        return;
      }
      const diff = debit - credit;
      const exprText = `차변 ${dcDebit} − 대변 ${dcCredit}`;
      setExpression("");
      syncPreview(exprText);
      setDisplaySilently(String(diff));
      pushAudit({
        id: uid(),
        at: Date.now(),
        kind: "expression",
        mode,
        expression: exprText,
        result: String(diff),
      });
      return;
    }

    if (mode === "allocation") {
      const total = Number(allocTotal);
      if (!Number.isFinite(total)) {
        setDisplayWithAudit("오류", "안분 정산 총액이 올바르지 않습니다.");
        return;
      }
      const basis = computeAllocationDays();
      if (!basis.ok) {
        setDisplayWithAudit("오류", basis.message);
        return;
      }
      const allocated = (total * basis.targetDays) / basis.yearDays;
      const exprText = `총액 ${allocTotal} × (${basis.targetDays} / ${basis.yearDays})`;
      setExpression("");
      syncPreview(exprText);
      setDisplaySilently(String(allocated));
      pushAudit({
        id: uid(),
        at: Date.now(),
        kind: "expression",
        mode,
        expression: exprText,
        result: String(allocated),
      });
    }
  }

  const taxBreakdown = useMemo(() => {
    if (!taxEnabled) return null;
    const gross = Number(display);
    if (!Number.isFinite(gross)) return null;
    const rate = taxRate / 100;
    const supply = rate >= 0 ? gross / (1 + rate) : gross;
    const vat = gross - supply;
    const round2 = (n: number) => Math.round(n * 100) / 100;
    return {
      supply: round2(supply),
      vat: round2(vat),
      gross: round2(gross),
    };
  }, [display, taxEnabled, taxRate]);

  const debitCreditDiff = useMemo(() => {
    // 변경 이유: 차대 대조 모드에서 차액을 실시간으로 계산
    const debit = Number(dcDebit);
    const credit = Number(dcCredit);
    if (!Number.isFinite(debit) || !Number.isFinite(credit)) return null;
    return debit - credit;
  }, [dcDebit, dcCredit]);

  function formatAccounting(raw: string, withComma: boolean): string {
    const normalized = raw.replace(/,/g, "").trim();
    const n = Number(normalized);
    if (!Number.isFinite(n)) return raw;
    if (!withComma) return normalized;
    return new Intl.NumberFormat("ko-KR").format(n);
  }

  function editNoteFor(id: string) {
    const target = audit.find((e) => e.id === id);
    const initial = target?.note ?? "";
    const next = window.prompt("해당 증적에 대한 메모를 입력하세요.", initial);
    if (next === null) return;
    const trimmed = next.trim();
    setAudit((prev) =>
      prev.map((e) => (e.id === id ? { ...e, note: trimmed.length === 0 ? undefined : trimmed } : e)),
    );
  }

  function exportAuditForWorkingPaper() {
    if (audit.length === 0) {
      window.alert("내보낼 로그가 없습니다.");
      return;
    }
    const header = [
      "시각",
      "모드/구분",
      "유형",
      "라벨/수식",
      "값(결과/전→후)",
      "메모",
    ].join("\t");
    const rows = audit.map((e) => {
      const time = formatTime(e.at);
      const kind =
        e.kind === "expression" ? "계산" : e.kind === "edit" ? "수정" : "설정";
      const modeLabelOrSetting =
        "mode" in e ? modeLabel(e.mode) : "설정";
      let label = "";
      let value = "";
      if (e.kind === "expression") {
        label = e.expression;
        value = e.result;
      } else if (e.kind === "edit") {
        label = e.label;
        value = `${e.before} → ${e.after}`;
      } else {
        label = e.label;
        value = e.value;
      }
      const note = e.note ?? "";
      return [time, modeLabelOrSetting, kind, label, value, note].join("\t");
    });
    const text = [header, ...rows].join("\n");
    void navigator.clipboard.writeText(text);
    window.alert("Audit 로그가 조서용 테이블 형식으로 복사되었습니다.");
  }

  function preparePayload(): Payload {
    const taxSnapshot: TaxSnapshot = {
      enabled: taxEnabled,
      rate: taxRate,
      supply: taxBreakdown ? taxBreakdown.supply : null,
      vat: taxBreakdown ? taxBreakdown.vat : null,
      gross: taxBreakdown ? taxBreakdown.gross : null,
    };

    const debitCreditSnapshot: DebitCreditSnapshot = {
      debit: dcDebit,
      credit: dcCredit,
      diff: debitCreditDiff,
    };

    const allocationSnapshot: AllocationSnapshot = {
      total: allocTotal,
      startDate: allocStart,
      endDate: allocEnd,
      includeStart: allocIncludeStart,
    };

    return {
      generatedAt: new Date().toISOString(),
      mode,
      display,
      expression,
      tax: taxSnapshot,
      debitCredit: debitCreditSnapshot,
      allocation: allocationSnapshot,
      audit,
    };
  }

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-6xl px-4 py-6">
        <header className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <SeparatorHorizontal className="h-5 w-5 opacity-80" aria-hidden />
            <div>
              <div className="text-sm opacity-70">회계사 전용</div>
              <h1 className="text-xl font-semibold tracking-tight">{headerTitle}</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTax}
              className={[
                "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium",
                "border-[color:var(--stroke)] bg-[color:var(--panel)] shadow-[0_12px_40px_var(--shadow)]",
                "transition hover:bg-[color:var(--panel-strong)]",
                taxEnabled ? "ring-2 ring-emerald-300/40" : "",
              ].join(" ")}
              aria-pressed={taxEnabled}
            >
              <Receipt className="h-4 w-4" aria-hidden />
              VAT/Tax {taxEnabled ? "ON" : "OFF"}
            </button>

            <div className="flex items-center gap-2 rounded-xl border border-[color:var(--stroke)] bg-[color:var(--panel)] px-3 py-2 text-sm shadow-[0_12px_40px_var(--shadow)]">
              <Percent className="h-4 w-4 opacity-80" aria-hidden />
              <label className="sr-only" htmlFor="taxRate">
                세율(%)
              </label>
              <input
                id="taxRate"
                inputMode="decimal"
                value={String(taxRate)}
                onChange={(e) => changeTaxRate(Number(e.target.value))}
                className="w-14 bg-transparent text-right outline-none"
                aria-label="세율(%)"
              />
            </div>
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
          {/* 메인 계산기 패드 */}
          <section
            className="rounded-3xl border border-[color:var(--stroke)] bg-[color:var(--panel)] p-4 shadow-[0_18px_60px_var(--shadow)]"
            aria-label="메인 계산기"
          >
            {mode !== "general" ? (
              <div className="mb-4 grid gap-3 rounded-2xl border border-[color:var(--stroke)] bg-black/15 p-3 text-sm">
                {mode === "debitCredit" ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setDcActive("debit")}
                        className={[
                          "rounded-xl border px-3 py-3 text-left",
                          "border-[color:var(--stroke)] bg-black/20",
                          dcActive === "debit" ? "ring-2 ring-emerald-200/25" : "hover:bg-black/25",
                        ].join(" ")}
                        aria-pressed={dcActive === "debit"}
                      >
                        <div className="text-xs opacity-70">차변 합계</div>
                        <div className="mt-1 font-mono text-lg font-semibold">{dcDebit}</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDcActive("credit")}
                        className={[
                          "rounded-xl border px-3 py-3 text-left",
                          "border-[color:var(--stroke)] bg-black/20",
                          dcActive === "credit" ? "ring-2 ring-emerald-200/25" : "hover:bg-black/25",
                        ].join(" ")}
                        aria-pressed={dcActive === "credit"}
                      >
                        <div className="text-xs opacity-70">대변 합계</div>
                        <div className="mt-1 font-mono text-lg font-semibold">{dcCredit}</div>
                      </button>
                    </div>
                    <div className="flex items-center justify-center rounded-xl border border-[color:var(--stroke)] bg-black/25 px-3 py-2 text-sm">
                      {debitCreditDiff !== null && debitCreditDiff !== 0 ? (
                        <div className="flex items-baseline gap-2 font-mono text-red-300">
                          <span className="text-[11px] opacity-80">Difference</span>
                          <span className="text-lg font-semibold animate-pulse">
                            {debitCreditDiff}
                          </span>
                        </div>
                      ) : debitCreditDiff !== null && debitCreditDiff === 0 ? (
                        <div className="flex items-center gap-2 text-emerald-200">
                          <CheckCircle className="h-4 w-4" aria-hidden />
                          <span className="text-sm font-semibold">Balanced</span>
                        </div>
                      ) : (
                        <span className="text-[11px] opacity-70">
                          차변/대변 합계를 입력하면 차액이 표시됩니다.
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-[1.1fr_1.5fr] gap-2">
                      <div className="rounded-xl border border-[color:var(--stroke)] bg-black/20 px-3 py-3">
                        <div className="text-xs opacity-70">총액</div>
                        <div className="mt-1 font-mono text-lg font-semibold">{allocTotal}</div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <label className="block text-[11px] opacity-70" htmlFor="allocStart">
                            시작일
                          </label>
                          <input
                            id="allocStart"
                            type="date"
                            value={allocStart}
                            onChange={(e) => setAllocStart(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-[color:var(--stroke)] bg-black/30 px-2 py-1 text-[11px] outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] opacity-70" htmlFor="allocEnd">
                            종료일
                          </label>
                          <input
                            id="allocEnd"
                            type="date"
                            value={allocEnd}
                            onChange={(e) => setAllocEnd(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-[color:var(--stroke)] bg-black/30 px-2 py-1 text-[11px] outline-none"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <button
                        type="button"
                        onClick={() => setAllocIncludeStart((v) => !v)}
                        className={[
                          "inline-flex items-center gap-1 rounded-lg border px-2 py-1",
                          "border-[color:var(--stroke)] bg-black/25",
                          allocIncludeStart ? "ring-2 ring-emerald-200/25" : "opacity-80",
                        ].join(" ")}
                        aria-pressed={allocIncludeStart}
                      >
                        <span>초일산입</span>
                        <span className="text-[10px] opacity-80">
                          {allocIncludeStart ? "포함" : "미포함"}
                        </span>
                      </button>
                      <div className="opacity-70">
                        = 버튼을 누르면 연간 일수 기준으로 안분 계산합니다.
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
            <div className="mb-4 rounded-2xl border border-[color:var(--stroke)] bg-black/20 p-4">
              <div className="text-xs opacity-70">{modeLabel(mode)}</div>
              <div className="mt-1 min-h-5 text-sm opacity-70">{expressionPreview || "\u00A0"}</div>
              <button
                type="button"
                onClick={(e: MouseEvent<HTMLButtonElement>) => {
                  const withComma = e.shiftKey;
                  let text = "";
                  if (taxBreakdown) {
                    const supplyText = formatAccounting(String(taxBreakdown.supply), withComma);
                    const vatText = formatAccounting(String(taxBreakdown.vat), withComma);
                    const grossText = formatAccounting(String(taxBreakdown.gross), withComma);
                    text = `${supplyText}\t${vatText}\t${grossText}`;
                  } else {
                    text = formatAccounting(display, withComma);
                  }
                  void navigator.clipboard.writeText(text);
                  pushAudit({
                    id: uid(),
                    at: Date.now(),
                    kind: "setting",
                    label: "복사",
                    value: taxBreakdown
                      ? withComma
                        ? "공급가액\t부가세\t합계 (콤마 포함)"
                        : "공급가액\t부가세\t합계 (콤마 제거)"
                      : withComma
                        ? `결과값(콤마 포함) ${display}`
                        : `결과값(콤마 제거) ${formatAccounting(display, false)}`,
                  });
                  // preparePayload는 외부 연동용으로, 필요 시 JSON.stringify(preparePayload()) 형태로 사용할 수 있습니다.
                  void preparePayload();
                }}
                className="mt-2 w-full rounded-xl bg-white/5 px-3 py-3 text-right font-mono text-3xl font-semibold tracking-tight hover:bg-white/8"
                aria-label="결과값(클릭하여 복사)"
                title="클릭하면 결과가 클립보드에 복사됩니다"
              >
                {display}
              </button>

              {taxBreakdown ? (
                <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl border border-[color:var(--stroke)] bg-black/15 p-3 text-xs">
                  <div>
                    <div className="opacity-70">공급가액</div>
                    <div className="mt-1 font-mono text-sm font-semibold">{taxBreakdown.supply}</div>
                  </div>
                  <div>
                    <div className="opacity-70">부가세</div>
                    <div className="mt-1 font-mono text-sm font-semibold">{taxBreakdown.vat}</div>
                  </div>
                  <div>
                    <div className="opacity-70">합계</div>
                    <div className="mt-1 font-mono text-sm font-semibold">{taxBreakdown.gross}</div>
                  </div>
                </div>
              ) : null}

              {mode === "allocation" ? (
                (() => {
                  const basis = computeAllocationDays();
                  if (!basis.ok) {
                    return (
                      <div className="mt-2 text-[11px] text-red-200/80">
                        {basis.message}
                      </div>
                    );
                  }
                  return (
                    <div className="mt-3 rounded-xl border border-[color:var(--stroke)] bg-black/15 p-2 text-[11px] opacity-80">
                      총 일수: {basis.yearDays}일 / 대상 일수: {basis.targetDays}일
                    </div>
                  );
                })()
              ) : null}
            </div>

            {/* 키패드(기계식 느낌) */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { k: "AC", icon: <RotateCcw className="h-4 w-4" aria-hidden />, tone: "op" },
                { k: "±", tone: "op" },
                { k: "%", tone: "op" },
                { k: "÷", tone: "op" },
                { k: "7" },
                { k: "8" },
                { k: "9" },
                { k: "×", tone: "op" },
                { k: "4" },
                { k: "5" },
                { k: "6" },
                { k: "−", tone: "op" },
                { k: "1" },
                { k: "2" },
                { k: "3" },
                { k: "+", tone: "op" },
                { k: "0" },
                { k: "." },
                { k: "⌫", tone: "op" },
                { k: "=", tone: "eq" },
              ].map((b) => (
                <button
                  key={b.k}
                  type="button"
                  onClick={() => {
                    if (b.k === "AC") clearAll();
                    if (b.k === "⌫") backspace();
                    if (b.k === "±") toggleSign();
                    if (b.k === "%") applyPercent();
                    if (b.k === ".") appendDecimal();
                    if (b.k >= "0" && b.k <= "9") appendDigit(b.k);
                    if (b.k === "+") pushOperator("+");
                    if (b.k === "−") pushOperator("-");
                    if (b.k === "×") pushOperator("*");
                    if (b.k === "÷") pushOperator("/");
                    if (b.k === "=") evaluateNow();
                  }}
                  className={[
                    "relative rounded-2xl border px-3 py-4 text-lg font-semibold",
                    "border-[color:var(--stroke)] bg-[color:var(--panel-strong)]",
                    "shadow-[0_10px_24px_rgba(0,0,0,0.45)]",
                    "transition active:translate-y-[1px] active:shadow-[0_6px_18px_rgba(0,0,0,0.35)]",
                    b.tone === "op" ? "text-pink-200" : "",
                    b.tone === "eq" ? "bg-emerald-400/15 text-emerald-100 ring-1 ring-emerald-200/20" : "",
                  ].join(" ")}
                  aria-label={`키 ${b.k}`}
                >
                  <span className="pointer-events-none inline-flex items-center justify-center gap-2">
                    {"icon" in b ? b.icon : null}
                    {b.k}
                  </span>
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-b from-white/10 to-transparent"
                  />
                </button>
              ))}
            </div>

            {/* 하단 탭 */}
            <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl border border-[color:var(--stroke)] bg-black/15 p-2">
              {([
                { id: "general", label: "일반 계산" },
                { id: "debitCredit", label: "차대 대조" },
                { id: "allocation", label: "안분 정산" },
              ] as const).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setMode(t.id);
                    pushAudit({
                      id: uid(),
                      at: Date.now(),
                      kind: "setting",
                      label: "모드 전환",
                      value: modeLabel(t.id),
                    });
                  }}
                  className={[
                    "rounded-xl px-3 py-2 text-sm font-semibold transition",
                    mode === t.id ? "bg-white/10 ring-1 ring-white/15" : "hover:bg-white/6",
                  ].join(" ")}
                  aria-pressed={mode === t.id}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </section>

          {/* 우측 사이드바: 디지털 증적 */}
          <aside
            className="rounded-3xl border border-[color:var(--stroke)] bg-[color:var(--panel)] p-4 shadow-[0_18px_60px_var(--shadow)]"
            aria-label="Digital Audit Trail"
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileClock className="h-5 w-5 opacity-80" aria-hidden />
                <h2 className="text-base font-semibold">Digital Audit Trail</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={exportAuditForWorkingPaper}
                  className="rounded-lg border border-[color:var(--stroke)] bg-black/20 px-2 py-1 text-[11px] hover:bg-black/30"
                >
                  Export for Working Paper
                </button>
                <button
                  type="button"
                  onClick={() => setAudit([])}
                  className="rounded-lg border border-[color:var(--stroke)] bg-black/15 px-2 py-1 text-xs hover:bg-black/25"
                  aria-label="로그 비우기"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {audit.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[color:var(--stroke)] bg-black/10 p-4 text-sm opacity-80">
                  아직 기록이 없습니다. 계산/수정/설정 변경이 발생하면 여기에 타임스탬프와 함께 남습니다.
                </div>
              ) : (
                audit.map((e) => (
                  <div
                    key={e.id}
                    className={[
                      "group rounded-2xl border border-[color:var(--stroke)] p-3 transition",
                      e.kind === "edit"
                        ? "bg-amber-900/35"
                        : "bg-black/10",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between text-xs opacity-70">
                      <div>{formatTime(e.at)}</div>
                      <div className="flex items-center gap-2">
                        {"mode" in e ? <div>{modeLabel(e.mode)}</div> : <div>설정</div>}
                        <button
                          type="button"
                          onClick={() => editNoteFor(e.id)}
                          className="rounded-full border border-[color:var(--stroke)] bg-black/40 px-2 py-0.5 text-[10px] opacity-0 transition group-hover:opacity-100"
                        >
                          Edit Note
                        </button>
                      </div>
                    </div>
                    <div className="mt-1 text-sm">
                      {e.kind === "expression" ? (
                        <div className="space-y-1">
                          <div className="font-mono opacity-90">{e.expression}</div>
                          <div className="font-mono font-semibold">= {e.result}</div>
                        </div>
                      ) : e.kind === "edit" ? (
                        <div className="space-y-1">
                          <div className="font-semibold">{e.label}</div>
                          <div className="font-mono text-xs opacity-80">
                            {e.before} → {e.after}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <div className="font-semibold">{e.label}</div>
                          <div className="font-mono text-xs opacity-80">{e.value}</div>
                        </div>
                      )}
                      {e.note ? (
                        <div className="mt-1 rounded-lg border border-amber-300/40 bg-amber-900/30 p-1.5 text-[11px]">
                          <span className="mr-1 font-semibold text-amber-100">메모</span>
                          <span className="opacity-90">{e.note}</span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-3 rounded-2xl border border-[color:var(--stroke)] bg-black/10 p-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <ClipboardCopy className="h-4 w-4 opacity-80" aria-hidden />
                결과값 클릭 시 복사
              </div>
              <div className="mt-1 text-xs opacity-70">
                다음 단계에서 엑셀 붙여넣기 친화 형식(탭/줄바꿈)까지 확장합니다.
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

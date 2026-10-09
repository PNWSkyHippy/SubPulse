/**
 * Samsung-Calculator-style engine (pure, UI-agnostic, unit-tested).
 *
 * Behaviour modelled on One UI's calculator:
 *  - The expression is built from keys: digits, ".", + − × ÷, "()", "%", "+/-", C, ⌫, =.
 *  - The "()" key is smart: it closes a bracket when one is open and the last
 *    token can end an operand, otherwise it opens one (inserting an implicit ×
 *    after a number or ")").
 *  - "%" divides the preceding operand by 100.
 *  - "+/-" toggles the sign of the last number by wrapping it as "(−n".
 *  - A live preview result is shown while typing; "=" commits it and keeps
 *    a history. Typing a digit after "=" starts fresh; an operator continues
 *    from the result.
 *  - Division by zero shows an error instead of Infinity.
 */

export type CalcKey =
  | '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'
  | '.' | '+' | '−' | '×' | '÷' | '()' | '%' | '±' | 'C' | '⌫' | '=';

export interface CalcHistoryEntry {
  expr: string;
  result: string;
}

export interface CalcState {
  expr: string;
  /** Set right after "=" so the next digit starts a new expression. */
  justEvaluated: boolean;
  error: string | null;
  history: CalcHistoryEntry[];
}

export const initialCalcState: CalcState = { expr: '', justEvaluated: false, error: null, history: [] };

const OPS = ['+', '−', '×', '÷'];
const MAX_LEN = 100;

const lastChar = (s: string) => s.slice(-1);
const isDigit = (c: string) => c >= '0' && c <= '9';
const endsOperand = (c: string) => isDigit(c) || c === ')' || c === '%' || c === '.';

function openParenCount(expr: string): number {
  let n = 0;
  for (const c of expr) {
    if (c === '(') n++;
    else if (c === ')') n--;
  }
  return n;
}

/** Index where the last number literal starts (or -1 if expression doesn't end in a number). */
function lastNumberStart(expr: string): number {
  let i = expr.length - 1;
  if (i < 0 || !(isDigit(expr[i]) || expr[i] === '.')) return -1;
  while (i >= 0 && (isDigit(expr[i]) || expr[i] === '.')) i--;
  return i + 1;
}

export function pressKey(state: CalcState, key: CalcKey): CalcState {
  let { expr } = state;
  const { history } = state;

  if (key === 'C') return { ...initialCalcState, history };

  if (key === '⌫') {
    if (state.justEvaluated) return { ...state, justEvaluated: false, error: null };
    // "(−" is inserted as a unit by ±, remove it as a unit
    expr = expr.endsWith('(−') ? expr.slice(0, -2) : expr.slice(0, -1);
    return { ...state, expr, error: null };
  }

  if (key === '=') {
    if (!expr) return state;
    const value = evaluateExpression(expr);
    if (value === null) return { ...state, error: 'Invalid format' };
    if (!Number.isFinite(value)) return { ...state, error: "Can't divide by 0" };
    const result = formatNumber(value);
    return {
      expr: toPlain(value),
      justEvaluated: true,
      error: null,
      history: [{ expr: closeParens(expr), result }, ...history].slice(0, 50),
    };
  }

  if (expr.length >= MAX_LEN) return { ...state, error: `Can't enter more than ${MAX_LEN} characters` };

  const last = lastChar(expr);

  if (isDigit(key)) {
    if (state.justEvaluated) expr = '';
    const l = lastChar(expr);
    if (l === ')' || l === '%') expr += '×';
    // avoid leading zeros like "007"
    const start = lastNumberStart(expr);
    if (start >= 0 && expr.slice(start) === '0') expr = expr.slice(0, -1);
    return { ...state, expr: expr + key, justEvaluated: false, error: null };
  }

  if (key === '.') {
    if (state.justEvaluated) expr = '';
    const start = lastNumberStart(expr);
    if (start >= 0 && expr.slice(start).includes('.')) return state; // one dot per number
    const l = lastChar(expr);
    if (l === ')' || l === '%') expr += '×';
    const prefix = start >= 0 ? '' : '0';
    return { ...state, expr: expr + prefix + '.', justEvaluated: false, error: null };
  }

  if (OPS.includes(key)) {
    if (!expr) {
      return key === '−' ? { ...state, expr: '−', justEvaluated: false, error: null } : state;
    }
    if (last === '(') {
      return key === '−' ? { ...state, expr: expr + '−', justEvaluated: false } : state;
    }
    if (OPS.includes(last)) {
      // replace the previous operator (but don't eat the unary minus after "(")
      if (expr.length === 1) return state;
      expr = expr.slice(0, -1);
    }
    if (lastChar(expr) === '.') expr = expr.slice(0, -1);
    return { ...state, expr: expr + key, justEvaluated: false, error: null };
  }

  if (key === '()') {
    if (state.justEvaluated) {
      return { ...state, expr: expr + '×(', justEvaluated: false };
    }
    const open = openParenCount(expr);
    if (open > 0 && endsOperand(last)) return { ...state, expr: expr + ')' };
    if (endsOperand(last)) return { ...state, expr: expr + '×(' };
    return { ...state, expr: expr + '(' };
  }

  if (key === '%') {
    if (!expr || !endsOperand(last) || last === '%') return state;
    return { ...state, expr: expr + '%', justEvaluated: false };
  }

  if (key === '±') {
    const start = lastNumberStart(expr);
    if (start < 0) {
      // no number yet: start a negative one
      if (!expr || OPS.includes(last) || last === '(') return { ...state, expr: expr + '(−', justEvaluated: false };
      return state;
    }
    if (expr.slice(0, start).endsWith('(−')) {
      // already negated: unwrap
      return { ...state, expr: expr.slice(0, start - 2) + expr.slice(start), justEvaluated: false };
    }
    return { ...state, expr: expr.slice(0, start) + '(−' + expr.slice(start), justEvaluated: false };
  }

  return state;
}

/** Appends the closing brackets the user didn't type. */
export function closeParens(expr: string): string {
  return expr + ')'.repeat(Math.max(0, openParenCount(expr)));
}

type Tok = { t: 'num'; v: number } | { t: 'op'; v: string } | { t: '('} | { t: ')' } | { t: '%' };

function tokenize(expr: string): Tok[] | null {
  const toks: Tok[] = [];
  let i = 0;
  while (i < expr.length) {
    const c = expr[i];
    if (isDigit(c) || c === '.') {
      let j = i;
      while (j < expr.length && (isDigit(expr[j]) || expr[j] === '.')) j++;
      const v = parseFloat(expr.slice(i, j));
      if (Number.isNaN(v)) return null;
      toks.push({ t: 'num', v });
      i = j;
      continue;
    }
    if (c === '(') toks.push({ t: '(' });
    else if (c === ')') toks.push({ t: ')' });
    else if (c === '%') toks.push({ t: '%' });
    else if (OPS.includes(c)) toks.push({ t: 'op', v: c });
    else if (c === ' ' || c === ',') {
      /* ignore */
    } else return null;
    i++;
  }
  return toks;
}

/**
 * Evaluates an expression using the calculator's symbols. Missing closing
 * brackets are tolerated; a trailing operator is ignored (so the live
 * preview works mid-typing). Returns null if the expression is malformed.
 */
export function evaluateExpression(rawExpr: string): number | null {
  let expr = rawExpr;
  while (expr && (OPS.includes(lastChar(expr)) || lastChar(expr) === '(')) expr = expr.slice(0, -1);
  if (!expr) return null;
  const tokens = tokenize(closeParens(expr));
  if (!tokens) return null;
  const toks: Tok[] = tokens;

  let pos = 0;
  const peek = () => toks[pos];

  // grammar: expr := term (('+'|'−') term)* ; term := factor (('×'|'÷') factor)* ;
  // factor := ('−') factor | primary '%'* ; primary := num | '(' expr ')'
  function parseExpr(): number | null {
    let left = parseTerm();
    if (left === null) return null;
    while (peek() && peek().t === 'op' && ((peek() as any).v === '+' || (peek() as any).v === '−')) {
      const op = (toks[pos++] as any).v;
      const right = parseTerm();
      if (right === null) return null;
      left = op === '+' ? left + right : left - right;
    }
    return left;
  }
  function parseTerm(): number | null {
    let left = parseFactor();
    if (left === null) return null;
    while (peek() && peek().t === 'op' && ((peek() as any).v === '×' || (peek() as any).v === '÷')) {
      const op = (toks[pos++] as any).v;
      const right = parseFactor();
      if (right === null) return null;
      left = op === '×' ? left * right : left / right;
    }
    return left;
  }
  function parseFactor(): number | null {
    const p = peek();
    if (p && p.t === 'op' && p.v === '−') {
      pos++;
      const v = parseFactor();
      return v === null ? null : -v;
    }
    let v = parsePrimary();
    if (v === null) return null;
    while (peek() && peek().t === '%') {
      pos++;
      v = v / 100;
    }
    return v;
  }
  function parsePrimary(): number | null {
    const p = toks[pos];
    if (!p) return null;
    if (p.t === 'num') {
      pos++;
      return p.v;
    }
    if (p.t === '(') {
      pos++;
      const v = parseExpr();
      if (v === null || !toks[pos] || toks[pos].t !== ')') return null;
      pos++;
      return v;
    }
    return null;
  }

  const result = parseExpr();
  if (result === null || pos !== toks.length) return null;
  // Trim binary floating point noise (0.1 + 0.2).
  return Number.isFinite(result) ? parseFloat(result.toPrecision(12)) : result;
}

/** Live preview: only shown once the expression contains an operation. */
export function previewResult(expr: string): string {
  if (!/[+−×÷%(]/.test(expr.replace(/^−/, ''))) return '';
  const v = evaluateExpression(expr);
  if (v === null || !Number.isFinite(v)) return '';
  return formatNumber(v);
}

/** Plain number string that can be typed back into the calculator (uses − for negatives). */
export function toPlain(v: number): string {
  const s = String(parseFloat(v.toPrecision(12)));
  if (s.includes('e')) return s; // extremely large/small; rare in a budgeting app
  return s.startsWith('-') ? '(−' + s.slice(1) : s;
}

/** Thousands separators, up to 10 decimals, like the Samsung display. */
export function formatNumber(v: number): string {
  if (!Number.isFinite(v)) return '∞';
  const negative = v < 0;
  const abs = Math.abs(v);
  if (abs !== 0 && (abs >= 1e15 || abs < 1e-10)) return (negative ? '-' : '') + abs.toExponential(6);
  const [intPart, decPart] = parseFloat(abs.toPrecision(12)).toFixed(10).replace(/0+$/, '').replace(/\.$/, '').split('.');
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (negative ? '-' : '') + withCommas + (decPart ? '.' + decPart : '');
}

/** Formats an in-progress expression for display (adds thousands separators to each number). */
export function formatExpression(expr: string): string {
  return expr.replace(/\d+(\.\d*)?/g, (m) => {
    const [i, d] = m.split('.');
    return i.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (d !== undefined ? '.' + d : '');
  });
}

/** Numeric value of the current state (committed result or live preview), or null. */
export function currentValue(state: CalcState): number | null {
  if (!state.expr) return null;
  const v = evaluateExpression(state.expr);
  return v !== null && Number.isFinite(v) ? v : null;
}

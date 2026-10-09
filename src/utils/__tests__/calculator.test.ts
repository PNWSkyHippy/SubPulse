import { CalcKey, CalcState, evaluateExpression, formatNumber, initialCalcState, pressKey, previewResult } from '../calculator';

const type = (keys: CalcKey[], from: CalcState = initialCalcState) => keys.reduce(pressKey, from);
const seq = (s: string): CalcKey[] => s.split(' ') as CalcKey[];

describe('calculator', () => {
  test('operator precedence', () => {
    expect(evaluateExpression('2+3×4')).toBe(14);
    expect(evaluateExpression('10−4÷2')).toBe(8);
  });

  test('smart brackets open and close', () => {
    const s = type(seq('() 2 + 3 () × 4'));
    expect(s.expr).toBe('(2+3)×4');
    expect(evaluateExpression(s.expr)).toBe(20);
  });

  test('implicit multiplication before an opening bracket', () => {
    expect(type(seq('3 ()')).expr).toBe('3×(');
  });

  test('percent divides by 100', () => {
    expect(evaluateExpression('50%')).toBe(0.5);
    expect(evaluateExpression('200×15%')).toBe(30);
  });

  test('plus/minus toggles the last number', () => {
    let s = type(seq('5 + 3 ±'));
    expect(s.expr).toBe('5+(−3');
    expect(evaluateExpression(s.expr)).toBe(2);
    s = pressKey(s, '±');
    expect(s.expr).toBe('5+3');
  });

  test('operator replaces previous operator', () => {
    expect(type(seq('5 + ×')).expr).toBe('5×');
  });

  test('one decimal point per number and leading 0 added', () => {
    expect(type(seq('. 5 . 2')).expr).toBe('0.52');
  });

  test('equals commits, keeps history, digit starts fresh, operator continues', () => {
    let s = type(seq('1842.20 ÷ 4 ='.replace('1842.20', '1 8 4 2 . 2 0')));
    expect(s.history[0].result).toBe('460.55');
    expect(s.justEvaluated).toBe(true);
    expect(type(seq('+ 1 ='), s).history[0].result).toBe('461.55');
    expect(pressKey(s, '7').expr).toBe('7');
  });

  test('division by zero reports an error', () => {
    expect(type(seq('5 ÷ 0 =')).error).toBe("Can't divide by 0");
  });

  test('backspace and clear', () => {
    expect(type(seq('1 2 3 ⌫')).expr).toBe('12');
    expect(type(seq('1 + 2 C')).expr).toBe('');
  });

  test('live preview ignores trailing operator and open bracket', () => {
    expect(previewResult('12+3×')).toBe('15');
    expect(previewResult('12')).toBe('');
  });

  test('float noise is removed and numbers are formatted', () => {
    expect(evaluateExpression('0.1+0.2')).toBe(0.3);
    expect(formatNumber(1234567.5)).toBe('1,234,567.5');
    expect(formatNumber(-0.25)).toBe('-0.25');
  });

  test('malformed expressions return null', () => {
    expect(evaluateExpression('')).toBeNull();
    expect(evaluateExpression('×5')).toBeNull();
  });
});

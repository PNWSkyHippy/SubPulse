import React, { useState } from 'react';
import { Pressable, Text, View, ScrollView } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../context/PreferencesContext';
import { Body, Button, Icon, Row } from '../ui/kit';
import {
  CalcKey,
  CalcState,
  currentValue,
  formatExpression,
  formatNumber,
  initialCalcState,
  pressKey,
  previewResult,
} from '../utils/calculator';

/**
 * Samsung-style calculator keypad. Layout mirrors One UI:
 *   C  ()  %  ÷
 *   7  8   9  ×
 *   4  5   6  −
 *   1  2   3  +
 *   ±  0   .  =
 * Optional actions let screens use the result (apply to an amount, split it).
 */
const ROWS: CalcKey[][] = [
  ['C', '()', '%', '÷'],
  ['7', '8', '9', '×'],
  ['4', '5', '6', '−'],
  ['1', '2', '3', '+'],
  ['±', '0', '.', '='],
];

export default function Calculator({
  initialValue,
  onApply,
  applyLabel = 'Apply result',
  onSplit,
  compact,
}: {
  initialValue?: number;
  onApply?: (value: number) => void;
  applyLabel?: string;
  onSplit?: (value: number) => void;
  compact?: boolean;
}) {
  const t = useTheme();
  const [state, setState] = useState<CalcState>(() =>
    initialValue !== undefined ? { ...initialCalcState, expr: String(initialValue) } : initialCalcState
  );
  const [showHistory, setShowHistory] = useState(false);

  const press = (k: CalcKey) => setState((s) => pressKey(s, k));
  const preview = previewResult(state.expr);
  const value = currentValue(state);
  const keySize = compact ? 52 : 64;

  const keyStyle = (k: CalcKey) => {
    if (k === '=') return { bg: t.colors.accent, fg: t.colors.onAccent };
    if (k === 'C') return { bg: t.colors.surface2, fg: t.colors.danger };
    if (['()', '%', '÷', '×', '−', '+'].includes(k)) return { bg: t.colors.surface2, fg: t.colors.accent };
    return { bg: t.colors.surface1, fg: t.colors.text };
  };

  return (
    <View style={{ gap: 10 }}>
      <View style={{ backgroundColor: t.colors.surface1, borderRadius: t.radius.card, borderWidth: t.borderWidth, borderColor: t.colors.border, padding: 14, minHeight: compact ? 90 : 120, justifyContent: 'flex-end' }}>
        {showHistory ? (
          <ScrollView style={{ maxHeight: 140 }}>
            {state.history.length === 0 ? <Body muted small>No history yet</Body> : null}
            {state.history.map((h, i) => (
              <Pressable key={i} onPress={() => { setState((s) => ({ ...s, expr: h.result.replace(/,/g, '').replace(/^-/, '(−'), justEvaluated: true })); setShowHistory(false); }}>
                <Body small muted style={{ textAlign: 'right' }}>{formatExpression(h.expr)}</Body>
                <Body style={{ textAlign: 'right', color: t.colors.accent, marginBottom: 6 }}>= {h.result}</Body>
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          <>
            <Text numberOfLines={2} adjustsFontSizeToFit style={{ color: state.justEvaluated ? t.colors.accent : t.colors.text, fontFamily: t.fonts.bodySemi, fontSize: compact ? 30 : 38, textAlign: 'right', fontVariant: ['tabular-nums'] }}>
              {formatExpression(state.expr) || '0'}
            </Text>
            <Text style={{ color: state.error ? t.colors.danger : t.colors.textMuted, fontFamily: t.fonts.body, fontSize: 18, textAlign: 'right', minHeight: 24, fontVariant: ['tabular-nums'] }}>
              {state.error ?? (preview && !state.justEvaluated ? preview : '')}
            </Text>
          </>
        )}
        <Row style={{ justifyContent: 'space-between', marginTop: 6 }}>
          <Row gap={16}>
            <Pressable onPress={() => setShowHistory((v) => !v)} hitSlop={8}>
              <Icon name="history" color={showHistory ? t.colors.accent : t.colors.textMuted} />
            </Pressable>
            <Pressable onPress={() => value !== null && Clipboard.setStringAsync(String(value))} hitSlop={8}>
              <Icon name="content-copy" />
            </Pressable>
          </Row>
          <Pressable onPress={() => press('⌫')} hitSlop={8} onLongPress={() => press('C')}>
            <Icon name="backspace-outline" color={t.colors.accent} />
          </Pressable>
        </Row>
      </View>

      {ROWS.map((row, ri) => (
        <View key={ri} style={{ flexDirection: 'row', gap: 8 }}>
          {row.map((k) => {
            const c = keyStyle(k);
            return (
              <Pressable
                key={k}
                accessibilityLabel={k}
                onPress={() => press(k)}
                style={({ pressed }) => ({
                  flex: 1,
                  height: keySize,
                  borderRadius: Math.min(t.radius.card + 4, keySize / 2),
                  backgroundColor: c.bg,
                  borderWidth: t.borderWidth,
                  borderColor: t.colors.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text style={{ color: c.fg, fontFamily: t.fonts.bodyMedium, fontSize: compact ? 22 : 26 }}>{k === '±' ? '+/−' : k}</Text>
              </Pressable>
            );
          })}
        </View>
      ))}

      {(onApply || onSplit) && (
        <Row>
          {onApply ? (
            <Button style={{ flex: 1 }} compact icon="check-circle-outline" title={value !== null ? `${applyLabel} (${formatNumber(value)})` : applyLabel} disabled={value === null} onPress={() => value !== null && onApply(Math.round(value * 100) / 100)} />
          ) : null}
          {onSplit ? <Button style={{ flex: 1 }} compact kind="secondary" icon="account-multiple-outline" title="Split with contacts" disabled={value === null} onPress={() => value !== null && onSplit(value)} /> : null}
        </Row>
      )}
    </View>
  );
}

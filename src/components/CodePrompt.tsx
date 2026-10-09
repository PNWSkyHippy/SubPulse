import React, { useCallback, useRef, useState } from 'react';
import { Modal, View } from 'react-native';
import { useTheme } from '../context/PreferencesContext';
import { Body, Button, Card, Heading, Input, Row } from '../ui/kit';

/**
 * Promise-based prompt for a 6-digit authenticator code.
 *   const [codePrompt, askCode] = useCodePrompt();
 *   const code = await askCode();   // null if cancelled
 *   ...render {codePrompt}
 */
export function useCodePrompt(): [React.ReactNode, (message?: string) => Promise<string | null>] {
  const t = useTheme();
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [code, setCode] = useState('');
  const resolver = useRef<((v: string | null) => void) | null>(null);

  const ask = useCallback((msg?: string) => {
    setMessage(msg ?? 'Enter the 6-digit code from your authenticator app.');
    setCode('');
    setVisible(true);
    return new Promise<string | null>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const finish = (v: string | null) => {
    setVisible(false);
    resolver.current?.(v);
    resolver.current = null;
  };

  const element = (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => finish(null)}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24 }}>
        <Card tier={3} style={{ gap: 12 }}>
          <Heading size="md">Two-step verification</Heading>
          <Body muted>{message}</Body>
          <Input
            mono
            autoFocus
            value={code}
            onChangeText={(v) => setCode(v.replace(/[^0-9]/g, '').slice(0, 6))}
            keyboardType="number-pad"
            placeholder="123 456"
            style={{ fontSize: 24, letterSpacing: 6, textAlign: 'center' }}
            onSubmitEditing={() => code.length === 6 && finish(code)}
          />
          <Row>
            <Button style={{ flex: 1 }} title="Verify" disabled={code.length !== 6} onPress={() => finish(code)} />
            <Button kind="secondary" title="Cancel" onPress={() => finish(null)} />
          </Row>
          <Body small muted style={{ color: t.colors.textFaint }}>Codes refresh every 30 seconds.</Body>
        </Card>
      </View>
    </Modal>
  );
  return [element, ask];
}

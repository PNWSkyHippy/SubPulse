import React, { useEffect, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { usePreferences, useTheme } from '../context/PreferencesContext';
import { Badge, Body, Button, Card, Chip, ChipRow, Field, Heading, Icon, Input, Label, Row, Screen, SectionHeader, ToggleRow } from '../ui/kit';
import {
  clientConfigs,
  createMcpToken,
  gatewayHealth,
  McpActivity,
  mcpEndpoint,
  McpScope,
  McpTokenRecord,
  revokeMcpToken,
  SCOPE_INFO,
  watchMcpActivity,
  watchMcpTokens,
} from '../utils/gateway';
import { attempt, friendlyError } from '../utils/errors';

export default function GatewayScreen({ navigation }: any) {
  const t = useTheme();
  const { gatewayUrl, setGatewayUrl } = usePreferences();
  const [urlDraft, setUrlDraft] = useState(gatewayUrl);
  const [health, setHealth] = useState<'unknown' | 'ok' | 'down'>('unknown');
  const [tokens, setTokens] = useState<McpTokenRecord[]>([]);
  const [activity, setActivity] = useState<McpActivity[]>([]);
  const [label, setLabel] = useState('Claude Desktop');
  const [scopes, setScopes] = useState<McpScope[]>(['read', 'write', 'payments']);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [client, setClient] = useState<'claudeCode' | 'geminiCli' | 'generic'>('claudeCode');

  useEffect(() => watchMcpTokens(setTokens), []);
  useEffect(() => watchMcpActivity(setActivity), []);
  useEffect(() => {
    if (!gatewayUrl) return setHealth('unknown');
    gatewayHealth(gatewayUrl)
      .then((h) => setHealth(h.ok ? 'ok' : 'down'))
      .catch(() => setHealth('down'));
  }, [gatewayUrl]);

  const toggleScope = (s: McpScope) => setScopes((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));

  const create = async () => {
    if (!scopes.includes('read')) return Alert.alert('Read access required', 'Agents need at least read access.');
    try {
      setNewToken(await createMcpToken(label, scopes));
    } catch (e: any) {
      Alert.alert('Could not create token', friendlyError(e));
    }
  };

  const configs = newToken && gatewayUrl ? clientConfigs(gatewayUrl, newToken) : null;

  return (
    <Screen>
      <Row>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <Icon name="chevron-left" size={26} color={t.colors.text} />
        </Pressable>
        <Heading size="md">Agentic MCP Gateway</Heading>
      </Row>
      <Body muted small>
        Lets AI agents (Claude Desktop / Code, Gemini CLI, Cursor…) read your bills, add entries, record payments and run the savings optimizer through the Model Context Protocol. The gateway is a small server you deploy once (see server/README.md); every agent gets its own revocable token.
      </Body>

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Label>Gateway URL</Label>
          <Badge text={health === 'ok' ? 'Online' : health === 'down' ? 'Unreachable' : 'Not set'} tone={health === 'ok' ? 'ok' : health === 'down' ? 'danger' : 'neutral'} />
        </Row>
        <Row style={{ marginTop: 6 }}>
          <Input style={{ flex: 1 }} value={urlDraft} onChangeText={setUrlDraft} autoCapitalize="none" autoCorrect={false} placeholder="https://subpulse-gateway-xxxx.run.app" />
          <Button compact title="Save" onPress={() => setGatewayUrl(urlDraft)} />
        </Row>
        {gatewayUrl ? (
          <Pressable onPress={() => Clipboard.setStringAsync(mcpEndpoint(gatewayUrl))}>
            <Row style={{ marginTop: 8, justifyContent: 'space-between' }}>
              <Body small style={{ color: t.colors.accent }}>{mcpEndpoint(gatewayUrl)}</Body>
              <Icon name="content-copy" size={16} />
            </Row>
            <Label>Streamable HTTP · Bearer auth</Label>
          </Pressable>
        ) : null}
      </Card>

      <Card>
        <SectionHeader title="New agent token" icon="key-outline" right={`${scopes.length}/4 scopes`} />
        <Field label="Agent name">
          <Input value={label} onChangeText={setLabel} />
        </Field>
        <Label style={{ marginTop: 10 }}>Agent permission matrix</Label>
        {(Object.keys(SCOPE_INFO) as McpScope[]).map((s) => (
          <ToggleRow key={s} title={SCOPE_INFO[s].title} subtitle={SCOPE_INFO[s].detail} value={scopes.includes(s)} onChange={() => toggleScope(s)} disabled={s === 'read'} />
        ))}
        <Button style={{ marginTop: 8 }} icon="shield-key-outline" title="Generate token" onPress={create} />
      </Card>

      {newToken ? (
        <Card tier={3}>
          <Label color={t.colors.warning}>Copy now — shown only once</Label>
          <Pressable onPress={() => Clipboard.setStringAsync(newToken)}>
            <Row style={{ justifyContent: 'space-between', marginTop: 6 }}>
              <Body style={{ flex: 1, fontFamily: t.fonts.bodyMedium }} numberOfLines={1}>{newToken}</Body>
              <Icon name="content-copy" />
            </Row>
          </Pressable>
          {configs ? (
            <>
              <ChipRow>
                <Chip label="Claude Code" active={client === 'claudeCode'} onPress={() => setClient('claudeCode')} />
                <Chip label="Gemini CLI" active={client === 'geminiCli'} onPress={() => setClient('geminiCli')} />
                <Chip label="Other / JSON" active={client === 'generic'} onPress={() => setClient('generic')} />
              </ChipRow>
              <View style={{ backgroundColor: t.colors.canvas, padding: 10, borderRadius: t.radius.control, marginTop: 8 }}>
                <Body small style={{ fontFamily: t.fonts.body }}>{configs[client]}</Body>
              </View>
              <Button style={{ marginTop: 8 }} compact kind="secondary" icon="content-copy" title="Copy config" onPress={() => Clipboard.setStringAsync(configs[client])} />
            </>
          ) : (
            <Body small muted>Set the gateway URL above to get ready-made client configs.</Body>
          )}
          <Button style={{ marginTop: 8 }} compact kind="ghost" title="Done" onPress={() => setNewToken(null)} />
        </Card>
      ) : null}

      <SectionHeader title="Registered agents" right={`${tokens.length} active`} />
      {tokens.length === 0 ? <Body small muted>No agent tokens yet.</Body> : null}
      {tokens.map((tk) => (
        <Card key={tk.id}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Body style={{ fontFamily: t.fonts.bodySemi }}>{tk.label}</Body>
              <Body small muted>…{tk.last4} · {tk.scopes.join(', ')} · {tk.createdAt.slice(0, 10)}</Body>
            </View>
            <Button
              compact
              kind="danger"
              title="Revoke"
              onPress={() =>
                Alert.alert('Revoke token?', `${tk.label} will lose access immediately.`, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Revoke', style: 'destructive', onPress: () => attempt('Could not revoke token', () => revokeMcpToken(tk.id)) },
                ])
              }
            />
          </Row>
        </Card>
      ))}

      {activity.length ? (
        <>
          <SectionHeader title="Recent agent activity" icon="history" />
          {activity.map((a) => (
            <Row key={a.id} style={{ justifyContent: 'space-between' }}>
              <Body small>{a.label} · {a.tool}</Body>
              <Body small muted style={{ color: a.ok ? t.colors.textMuted : t.colors.danger }}>{a.at.slice(5, 16).replace('T', ' ')}</Body>
            </Row>
          ))}
        </>
      ) : null}
    </Screen>
  );
}

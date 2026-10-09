import React, { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import Constants from 'expo-constants';
import { useAuth } from '../context/AuthContext';
import { useSubscriptions } from '../context/SubscriptionsContext';
import { usePreferences, useTheme } from '../context/PreferencesContext';
import { useCashflow } from '../hooks/useCashflow';
import { AppHeader, Badge, Body, Button, Card, Icon, IconName, Label, Metric, Row, Screen, SectionHeader } from '../ui/kit';
import { formatCurrency } from '../utils/currency';
import { exportSubscriptionsToCSV } from '../utils/csvExport';
import { requestNotificationPermission } from '../utils/notifications';
import { McpTokenRecord, watchMcpTokens } from '../utils/gateway';
import { PRESETS } from '../theme/theme';

function NavRow({ icon, title, subtitle, right, onPress }: { icon: IconName; title: string; subtitle?: string; right?: React.ReactNode; onPress: () => void }) {
  const t = useTheme();
  return (
    <Card onPress={onPress}>
      <Row>
        <Icon name={icon} color={t.colors.accent} size={22} />
        <View style={{ flex: 1 }}>
          <Body style={{ fontFamily: t.fonts.bodySemi }}>{title}</Body>
          {subtitle ? <Body small muted>{subtitle}</Body> : null}
        </View>
        {right}
        <Icon name="chevron-right" />
      </Row>
    </Card>
  );
}

export default function SettingsScreen({ navigation }: any) {
  const t = useTheme();
  const { user, signOut } = useAuth();
  const { subscriptions, contacts, notes } = useSubscriptions();
  const { isPremium, baseCurrency, gatewayUrl, themeSettings } = usePreferences();
  const cf = useCashflow();
  const [tokens, setTokens] = useState<McpTokenRecord[]>([]);
  useEffect(() => watchMcpTokens(setTokens), []);

  return (
    <Screen>
      <AppHeader section="Settings & MCP" />

      <Card tier={2}>
        <Label>Signed in</Label>
        <Body style={{ fontFamily: t.fonts.bodySemi }}>{user?.email}</Body>
        <Row style={{ marginTop: 8, justifyContent: 'space-between' }}>
          <Badge text={isPremium ? 'Pro · ad-free' : 'Free · ad-supported'} tone={isPremium ? 'ok' : 'warn'} />
          <Button compact kind="danger" title="Sign out" onPress={signOut} />
        </Row>
      </Card>

      <SectionHeader title="System matrix" />
      <NavRow
        icon="bank-outline"
        title="Stripe & balances"
        subtitle={cf.stripeLinked ? `Linked · ${formatCurrency(cf.balanceTotal, baseCurrency)} available` : 'Link bank balances or add them manually'}
        right={<Badge text={cf.stripeLinked ? 'Live' : 'Off'} tone={cf.stripeLinked ? 'ok' : 'neutral'} />}
        onPress={() => navigation.navigate('Balances')}
      />
      <NavRow
        icon="robot-outline"
        title="Agentic MCP gateway"
        subtitle={gatewayUrl ? `${tokens.length} agent token${tokens.length === 1 ? '' : 's'} · ${gatewayUrl.replace(/^https?:\/\//, '')}` : 'Connect Claude, Gemini & other agents'}
        right={<Badge text={gatewayUrl ? 'Configured' : 'Setup'} tone={gatewayUrl ? 'ok' : 'warn'} />}
        onPress={() => navigation.navigate('Gateway')}
      />
      <NavRow icon="contacts-outline" title="Contacts mesh" subtitle={`${contacts.length} contacts · Google & Android import`} onPress={() => navigation.navigate('Contacts')} />
      <NavRow icon="note-text-outline" title="Notes" subtitle={`${notes.length} notes · export to Keep / Gemini`} onPress={() => navigation.navigate('Notes')} />

      <SectionHeader title="Plan" />
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <View>
            <Label color={isPremium ? t.colors.accent : t.colors.warning}>Current plan</Label>
            <Body style={{ fontFamily: t.fonts.bodySemi }}>{isPremium ? 'SubPulse Pro (ad-free)' : 'Free tier (ad-supported)'}</Body>
          </View>
          {!isPremium ? <Button compact icon="crown-outline" title="Go ad-free" onPress={() => navigation.navigate('Paywall')} /> : null}
        </Row>
      </Card>

      <SectionHeader title="Display" />
      <NavRow icon="palette-outline" title="Theme & surface customizer" subtitle={PRESETS[themeSettings.preset].label} onPress={() => navigation.navigate('Theme')} />
      <NavRow icon="currency-usd" title="Currency & forex" subtitle={`Base currency ${baseCurrency}`} onPress={() => navigation.navigate('Currency')} />

      <SectionHeader title="Notifications" />
      <Card>
        <Body small muted>Renewal reminders, due-today notices and overdue escalations are scheduled on this phone.</Body>
        <Button
          style={{ marginTop: 8 }}
          compact
          kind="secondary"
          icon="bell-ring-outline"
          title="Check notification permission"
          onPress={async () => Alert.alert((await requestNotificationPermission()) ? 'Notifications on' : 'Notifications blocked', 'You can change this in system settings.')}
        />
      </Card>

      <SectionHeader title="Data storage" />
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Label>Synced entries</Label>
          <Metric size={16}>{subscriptions.length}</Metric>
        </Row>
        <Row style={{ marginTop: 8 }}>
          <Button
            style={{ flex: 1 }}
            compact
            kind="secondary"
            icon="download-outline"
            title="Export CSV"
            onPress={() => (subscriptions.length ? exportSubscriptionsToCSV(subscriptions).catch((e) => Alert.alert('Export failed', e.message)) : Alert.alert('Nothing to export'))}
          />
          <Button style={{ flex: 1 }} compact kind="secondary" icon="upload-outline" title="Import CSV" onPress={() => navigation.navigate('Add', { mode: 'csv' })} />
        </Row>
        <Label style={{ marginTop: 8 }}>Firestore · per-user isolation rules</Label>
      </Card>

      <Body small muted style={{ textAlign: 'center', marginTop: 8 }}>SubPulse {Constants.expoConfig?.version ?? ''}</Body>
    </Screen>
  );
}

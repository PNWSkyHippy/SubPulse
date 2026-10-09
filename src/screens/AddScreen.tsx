import React, { useEffect, useMemo, useState } from 'react';
import { Alert, View } from 'react-native';
import { useSubscriptions } from '../context/SubscriptionsContext';
import { usePreferences, useTheme } from '../context/PreferencesContext';
import ItemForm, { ItemFormValues } from '../components/ItemForm';
import { KIND_ICONS } from '../components/ItemCard';
import {
  AppHeader,
  Avatar,
  Badge,
  Body,
  Button,
  Card,
  Heading,
  Input,
  Label,
  Row,
  Screen,
  SectionHeader,
  Segmented,
} from '../ui/kit';
import { CATALOG, CATALOG_AS_OF, CATALOG_DEFAULT_CYCLE, CatalogPlan, CatalogService, matchCatalogByName, searchCatalog } from '../data/catalog';
import { formatCurrency } from '../utils/currency';
import { exportSubscriptionsToCSV, pickAndParseSubscriptionsCSV } from '../utils/csvExport';
import { CSVImportResult, parseSubscriptionsCSV } from '../utils/csv';
import { maybeShowInterstitialAfterSave } from '../utils/ad';
import { formatISODate, todayLocal } from '../utils/dateHelpers';
import { friendlyError } from '../utils/errors';

type Mode = 'known' | 'custom' | 'csv';

export default function AddScreen({ navigation, route }: any) {
  const t = useTheme();
  const { addSubscription, subscriptions } = useSubscriptions();
  const { isPremium } = usePreferences();
  const [mode, setMode] = useState<Mode>(route?.params?.mode ?? 'known');
  const [query, setQuery] = useState('');
  const [prefill, setPrefill] = useState<Partial<ItemFormValues> | null>(null);
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    if (route?.params?.mode) {
      setMode(route.params.mode);
      setPrefill(null);
    }
  }, [route?.params?.mode]);

  const results = useMemo(() => searchCatalog(query, 80), [query]);

  const save = async (values: ItemFormValues) => {
    const id = await addSubscription(values);
    setPrefill(null);
    setFormKey((k) => k + 1);
    maybeShowInterstitialAfterSave(isPremium);
    navigation.navigate('ItemDetail', { id });
  };

  const choose = (svc: CatalogService, plan: CatalogPlan) => {
    const cycle = CATALOG_DEFAULT_CYCLE(plan);
    const price = cycle === 'monthly' ? plan.monthly : plan.yearly;
    setPrefill({
      name: svc.plans.length > 1 ? `${svc.name} ${plan.label}` : svc.name,
      catalogId: svc.id,
      kind: svc.kind,
      category: svc.category,
      cost: price,
      billingCycle: cycle,
      alternatePrices: plan.monthly !== undefined && plan.yearly !== undefined ? (cycle === 'monthly' ? { yearly: plan.yearly } : { monthly: plan.monthly }) : undefined,
      nextRenewalDate: formatISODate(todayLocal()),
    });
    setFormKey((k) => k + 1);
  };

  const pickService = (svc: CatalogService) => {
    if (svc.plans.length === 1) return choose(svc, svc.plans[0]);
    Alert.alert(svc.name, 'Which plan are you on?', [
      ...svc.plans.map((p) => ({
        text: `${p.label}${p.monthly !== undefined ? ` · ${p.monthly}/mo` : p.yearly !== undefined ? ` · ${p.yearly}/yr` : ''}`,
        onPress: () => choose(svc, p),
      })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  return (
    <Screen>
      <AppHeader section="Add & CSV" />
      <Segmented<Mode>
        value={mode}
        onChange={(m) => {
          setMode(m);
          setPrefill(null);
        }}
        options={[
          { value: 'known', label: 'Known App' },
          { value: 'custom', label: 'Custom / Lease' },
          { value: 'csv', label: 'CSV Hub' },
        ]}
      />

      {mode === 'known' && !prefill ? (
        <>
          <Input value={query} onChangeText={setQuery} placeholder="Filter catalog (e.g. Netflix, rent, VPN)" autoCorrect={false} />
          <Row style={{ justifyContent: 'space-between' }}>
            <SectionHeader title={query ? 'Matches' : 'Popular subscriptions'} />
            <Label>Tap to fill</Label>
          </Row>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {results.map((svc) => {
              const p = svc.plans[0];
              const price = p.monthly !== undefined ? `${formatCurrency(p.monthly, 'USD')}/mo` : p.yearly !== undefined ? `${formatCurrency(p.yearly, 'USD')}/yr` : 'Custom amount';
              return (
                <Card key={svc.id} onPress={() => pickService(svc)} style={{ width: '48.6%', gap: 6 }}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Avatar name={svc.name} size={32} icon={svc.kind === 'subscription' || svc.kind === 'membership' ? undefined : KIND_ICONS[svc.kind]} />
                    {svc.plans.length > 1 ? <Badge text={`${svc.plans.length} plans`} /> : null}
                  </Row>
                  <Body numberOfLines={1} style={{ fontFamily: t.fonts.bodySemi }}>{svc.name}</Body>
                  <Body small muted>{price}</Body>
                </Card>
              );
            })}
          </View>
          <Card onPress={() => setMode('custom')}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Body style={{ fontFamily: t.fonts.bodySemi }}>Recurring ledger entry</Body>
                <Body small muted>Leases, utilities, loans, magazines, one-time fees</Body>
              </View>
              <Badge text="Custom" tone="accent" />
            </Row>
          </Card>
          <Body small muted>Prices are typical US list prices ({CATALOG_AS_OF}); edit to match your bill. {CATALOG.length} services in catalog.</Body>
        </>
      ) : null}

      {(mode === 'custom' || (mode === 'known' && prefill)) ? (
        <>
          {prefill ? (
            <Row style={{ justifyContent: 'space-between' }}>
              <Heading size="sm">{prefill.name}</Heading>
              <Button compact kind="ghost" title="Back to catalog" onPress={() => setPrefill(null)} />
            </Row>
          ) : null}
          <ItemForm key={formKey} initial={prefill ?? undefined} submitLabel="Commit to active ledger" onSubmit={save} />
        </>
      ) : null}

      {mode === 'csv' ? <CsvHub count={subscriptions.length} onDone={() => navigation.navigate('Dashboard')} /> : null}
    </Screen>
  );
}

function CsvHub({ count, onDone }: { count: number; onDone: () => void }) {
  const { subscriptions, addSubscription } = useSubscriptions();
  const [text, setText] = useState('');
  const [result, setResult] = useState<CSVImportResult | null>(null);
  const [busy, setBusy] = useState(false);

  const commit = async (res: CSVImportResult) => {
    setBusy(true);
    let added = 0;
    try {
      for (const row of res.rows) {
        await addSubscription({ ...row, catalogId: row.catalogId ?? matchCatalogByName(row.name)?.id });
        added++;
      }
      Alert.alert('Import complete', `Added ${added} entr${added === 1 ? 'y' : 'ies'}.`);
      setResult(null);
      setText('');
      onDone();
    } catch (e: any) {
      Alert.alert('Import stopped', `${added} added before an error: ${friendlyError(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const pickFile = async () => {
    try {
      const res = await pickAndParseSubscriptionsCSV();
      if (res) setResult(res);
    } catch (e: any) {
      Alert.alert('Could not read file', friendlyError(e));
    }
  };

  const exportAll = async () => {
    if (!subscriptions.length) return Alert.alert('Nothing to export', 'Add an entry first.');
    try {
      await exportSubscriptionsToCSV(subscriptions);
    } catch (e: any) {
      Alert.alert('Export failed', friendlyError(e));
    }
  };

  return (
    <>
      <Card>
        <SectionHeader title="Import" icon="upload-outline" />
        <Body small muted style={{ marginVertical: 6 }}>
          Accepts SubPulse exports and spreadsheet CSVs. Columns are matched by header: Name and Cost (or Amount) are required; Billing Cycle, Next Renewal (YYYY-MM-DD), Currency, Category, Kind, Auto Pay, Notes are optional.
        </Body>
        <Button icon="file-delimited-outline" title="Choose CSV file" onPress={pickFile} />
        <Label style={{ marginTop: 12, marginBottom: 6 }}>…or paste CSV text</Label>
        <Input value={text} onChangeText={setText} multiline style={{ minHeight: 110, textAlignVertical: 'top' }} placeholder={'Name,Cost,Billing Cycle,Next Renewal\nNetflix,17.99,monthly,2026-11-01\nRent,1200,monthly,2026-11-01'} />
        <Button style={{ marginTop: 8 }} kind="secondary" title="Parse pasted text" disabled={!text.trim()} onPress={() => setResult(parseSubscriptionsCSV(text))} />
      </Card>

      {result ? (
        <Card tier={2}>
          <Heading size="sm">{result.rows.length} row{result.rows.length === 1 ? '' : 's'} ready</Heading>
          {result.rows.slice(0, 8).map((r, i) => (
            <Body key={i} small muted>• {r.name} — {formatCurrency(r.cost, r.currency)} {r.billingCycle} (next {r.nextRenewalDate})</Body>
          ))}
          {result.rows.length > 8 ? <Body small muted>…and {result.rows.length - 8} more</Body> : null}
          {result.errors.length ? (
            <View style={{ marginTop: 8 }}>
              <Label>{result.errors.length} note(s)</Label>
              {result.errors.slice(0, 6).map((e, i) => (
                <Body key={i} small muted>{e}</Body>
              ))}
            </View>
          ) : null}
          <Row style={{ marginTop: 10 }}>
            <Button style={{ flex: 1 }} title={`Commit ${result.rows.length}`} disabled={!result.rows.length} loading={busy} onPress={() => commit(result)} />
            <Button kind="secondary" title="Discard" onPress={() => setResult(null)} />
          </Row>
        </Card>
      ) : null}

      <Card>
        <SectionHeader title="Export" icon="download-outline" />
        <Body small muted style={{ marginVertical: 6 }}>Exports all {count} entries (including leases, utilities and status) to a CSV you can open in Sheets/Excel or re-import later.</Body>
        <Button kind="secondary" icon="share-variant-outline" title="Export everything (CSV)" onPress={exportAll} />
      </Card>
    </>
  );
}

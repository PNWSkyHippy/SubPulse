import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSubscriptions } from '../context/SubscriptionsContext';
import { useTheme } from '../context/PreferencesContext';
import { Avatar, Badge, Body, Card, Heading, Icon, Label, Metric, Row, Screen, SectionHeader } from '../ui/kit';
import { getMonthGrid, formatISODate, daysUntil } from '../utils/dateHelpers';
import { chargesInWindow, ScheduledCharge, statusOf } from '../utils/billing';
import { formatCurrency } from '../utils/currency';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * Month view of every expected charge (weekly items appear each week),
 * overdue bills (shown on today) and, for past days, payments recorded.
 */
export default function CalendarScreen({ navigation }: any) {
  const t = useTheme();
  const { subscriptions, payments } = useSubscriptions();
  const today = useMemo(() => new Date(), []);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selected, setSelected] = useState<string | null>(null);

  const grid = useMemo(() => getMonthGrid(year, month), [year, month]);
  const todayKey = formatISODate(today);
  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;

  const charges = useMemo(() => {
    const monthEnd = new Date(Date.UTC(year, month + 1, 0));
    const days = daysUntil(monthEnd, today);
    if (days < 0) return [] as ScheduledCharge[];
    return chargesInWindow(subscriptions.filter((s) => statusOf(s) === 'active'), days, today).filter((c) => c.dateISO.startsWith(monthPrefix));
  }, [subscriptions, year, month, today, monthPrefix]);

  const byDay = useMemo(() => {
    const m: Record<string, { charges: ScheduledCharge[]; paid: number }> = {};
    for (const c of charges) (m[c.dateISO] ??= { charges: [], paid: 0 }).charges.push(c);
    for (const p of payments) if (p.paidDate.startsWith(monthPrefix)) (m[p.paidDate] ??= { charges: [], paid: 0 }).paid++;
    return m;
  }, [charges, payments, monthPrefix]);

  const monthTotal = charges.reduce((sum, c) => sum + c.amount, 0);
  const currency = charges[0]?.currency ?? 'USD';
  const shift = (d: number) => {
    const m = month + d;
    setYear(year + Math.floor(m / 12));
    setMonth(((m % 12) + 12) % 12);
    setSelected(null);
  };
  const list = selected ? byDay[selected]?.charges ?? [] : charges;
  const itemName = (id: string) => subscriptions.find((s) => s.id === id)?.name ?? 'Deleted item';

  return (
    <Screen>
      <Row>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <Icon name="chevron-left" size={26} color={t.colors.text} />
        </Pressable>
        <Heading size="md">Calendar</Heading>
      </Row>
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Pressable onPress={() => shift(-1)} hitSlop={12}><Icon name="chevron-left" color={t.colors.accent} /></Pressable>
          <Heading size="sm">{MONTHS[month]} {year}</Heading>
          <Pressable onPress={() => shift(1)} hitSlop={12}><Icon name="chevron-right" color={t.colors.accent} /></Pressable>
        </Row>
        <Row style={{ marginTop: 10 }} gap={0}>
          {WEEKDAYS.map((w, i) => (
            <Label key={i} style={{ flex: 1, textAlign: 'center' }}>{w}</Label>
          ))}
        </Row>
        {grid.map((week, wi) => (
          <Row key={wi} gap={0} style={{ marginTop: 4 }}>
            {week.map((day, di) => {
              if (day === null) return <View key={di} style={{ flex: 1, height: 40 }} />;
              const key = `${monthPrefix}-${String(day).padStart(2, '0')}`;
              const info = byDay[key];
              const isToday = key === todayKey;
              const isSel = key === selected;
              const overdue = info?.charges.some((c) => c.dateISO === todayKey && isToday && c.item.nextRenewalDate < todayKey);
              return (
                <Pressable key={di} onPress={() => setSelected(isSel ? null : key)} style={{ flex: 1, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 6, backgroundColor: isSel ? t.colors.accentSoft : 'transparent', borderWidth: isToday ? 1 : 0, borderColor: t.colors.accent }}>
                  <Text style={{ color: t.colors.text, fontFamily: t.fonts.bodyMedium, fontSize: 13 }}>{day}</Text>
                  <Row gap={2}>
                    {info?.charges.length ? <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: overdue ? t.colors.danger : t.colors.warning }} /> : null}
                    {info?.paid ? <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: t.colors.accent }} /> : null}
                  </Row>
                </Pressable>
              );
            })}
          </Row>
        ))}
        <Row style={{ marginTop: 8 }} gap={12}>
          <Row gap={4}><View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: t.colors.warning }} /><Body small muted>due</Body></Row>
          <Row gap={4}><View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: t.colors.accent }} /><Body small muted>paid</Body></Row>
        </Row>
      </Card>

      <Card tier={2}>
        <Label>{selected ? `Due ${selected}` : 'Expected this month'}</Label>
        <Metric size={22}>{formatCurrency(selected ? list.reduce((s, c) => s + c.amount, 0) : monthTotal, currency)}</Metric>
      </Card>

      <SectionHeader title={selected ? 'That day' : 'Upcoming charges'} right={`${list.length}`} />
      {list.length === 0 ? <Body small muted>Nothing scheduled.</Body> : null}
      {list.map((c, i) => (
        <Card key={`${c.item.id}-${c.dateISO}-${i}`} onPress={() => navigation.navigate('ItemDetail', { id: c.item.id })}>
          <Row>
            <Avatar name={c.item.name} size={32} />
            <View style={{ flex: 1 }}>
              <Body>{c.item.name}</Body>
              <Body small muted>{c.dateISO}</Body>
            </View>
            <Metric size={15}>{formatCurrency(c.amount, c.currency)}</Metric>
          </Row>
        </Card>
      ))}
      {selected && byDay[selected]?.paid ? (
        <>
          <SectionHeader title="Payments recorded" />
          {payments.filter((p) => p.paidDate === selected).map((p) => (
            <Row key={p.id} style={{ justifyContent: 'space-between' }}>
              <Body small>{itemName(p.itemId)}</Body>
              <Badge text={formatCurrency(p.amount, p.currency)} tone="ok" />
            </Row>
          ))}
        </>
      ) : null}
    </Screen>
  );
}

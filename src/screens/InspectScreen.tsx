import React, { useMemo, useState } from 'react';
import { useSubscriptions } from '../context/SubscriptionsContext';
import { AppHeader, Button, Chip, ChipRow, EmptyState, Input, Row, Screen, SectionHeader } from '../ui/kit';
import ItemCard from '../components/ItemCard';
import { Subscription } from '../types';
import { getDueInfo, normalizeCycleCost, statusOf } from './inspectHelpers';

type SortKey = 'due' | 'cost' | 'name' | 'category';
type StatusFilter = 'active' | 'attention' | 'inactive' | 'all';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'due', label: 'Due date' },
  { key: 'cost', label: 'Monthly cost' },
  { key: 'name', label: 'Name' },
  { key: 'category', label: 'Category' },
];

export default function InspectScreen({ navigation }: any) {
  const { subscriptions } = useSubscriptions();
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<SortKey>('due');
  const [desc, setDesc] = useState(false);
  const [status, setStatus] = useState<StatusFilter>('active');

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = subscriptions.filter((s) => !needle || s.name.toLowerCase().includes(needle) || (s.category ?? '').toLowerCase().includes(needle) || (s.notes ?? '').toLowerCase().includes(needle));
    list = list.filter((s) => {
      const st = statusOf(s);
      if (status === 'all') return true;
      if (status === 'inactive') return st !== 'active';
      if (status === 'attention') {
        const d = getDueInfo(s).state;
        return d === 'overdue' || d === 'due-today' || d === 'upcoming';
      }
      return st === 'active';
    });
    const key = (s: Subscription): string | number => {
      switch (sort) {
        case 'cost':
          return normalizeCycleCost(s);
        case 'name':
          return s.name.toLowerCase();
        case 'category':
          return (s.category ?? 'zzz').toLowerCase();
        default:
          return getDueInfo(s).dueDateISO;
      }
    };
    const sorted = [...list].sort((a, b) => {
      const ka = key(a);
      const kb = key(b);
      return typeof ka === 'number' && typeof kb === 'number' ? ka - kb : String(ka).localeCompare(String(kb));
    });
    return desc ? sorted.reverse() : sorted;
  }, [subscriptions, q, sort, desc, status]);

  return (
    <Screen>
      <AppHeader section="Inspect & Ledger" />
      <Input value={q} onChangeText={setQ} placeholder="Search name, category or notes" />
      <ChipRow>
        {(['active', 'attention', 'inactive', 'all'] as StatusFilter[]).map((s) => (
          <Chip key={s} label={s === 'attention' ? 'Needs attention' : s[0].toUpperCase() + s.slice(1)} active={status === s} onPress={() => setStatus(s)} />
        ))}
      </ChipRow>
      <ChipRow>
        {SORTS.map((o) => (
          <Chip
            key={o.key}
            icon="sort"
            label={`${o.label}${sort === o.key ? (desc ? ' ↓' : ' ↑') : ''}`}
            active={sort === o.key}
            onPress={() => (sort === o.key ? setDesc(!desc) : (setSort(o.key), setDesc(false)))}
          />
        ))}
      </ChipRow>
      <Row>
        <Button compact kind="secondary" style={{ flex: 1 }} icon="calendar-month-outline" title="Calendar" onPress={() => navigation.navigate('Calendar')} />
        <Button compact kind="secondary" style={{ flex: 1 }} icon="note-text-outline" title="Notes" onPress={() => navigation.navigate('Notes')} />
        <Button compact kind="secondary" style={{ flex: 1 }} icon="calculator-variant" title="Calc" onPress={() => navigation.navigate('Calculator')} />
      </Row>
      <SectionHeader title="Recurring liability ledger" right={`${rows.length} shown`} />
      {rows.length === 0 ? <EmptyState icon="magnify" title="No matches" body="Try another filter or search." /> : null}
      {rows.map((s) => (
        <ItemCard key={s.id} sub={s} onPress={() => navigation.navigate('ItemDetail', { id: s.id })} />
      ))}
    </Screen>
  );
}

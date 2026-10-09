import React, { useMemo, useState } from 'react';
import { Pressable } from 'react-native';
import { useSubscriptions } from '../context/SubscriptionsContext';
import { useTheme } from '../context/PreferencesContext';
import { Badge, Body, Button, Card, EmptyState, Heading, Icon, Input, Row, Screen } from '../ui/kit';

export default function NotesScreen({ navigation, route }: any) {
  const t = useTheme();
  const { notes, subscriptions } = useSubscriptions();
  const itemId: string | undefined = route?.params?.itemId;
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const n = q.trim().toLowerCase();
    return notes
      .filter((x) => (!itemId || x.itemId === itemId) && (!n || x.title.toLowerCase().includes(n) || x.body.toLowerCase().includes(n) || (x.tags ?? []).some((tg) => tg.toLowerCase().includes(n))))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [notes, q, itemId]);
  const itemName = (id?: string) => subscriptions.find((s) => s.id === id)?.name;

  return (
    <Screen>
      <Row>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <Icon name="chevron-left" size={26} color={t.colors.text} />
        </Pressable>
        <Heading size="md">Notes</Heading>
      </Row>
      <Input value={q} onChangeText={setQ} placeholder="Search notes and #tags" />
      <Button icon="plus" title="New note" onPress={() => navigation.navigate('NoteEditor', { itemId })} />
      {list.length === 0 ? <EmptyState icon="note-text-outline" title="No notes yet" body="Attach notes to any bill (lease clauses, cancellation steps, receipts) and export them to Google Keep or Gemini." /> : null}
      {list.map((n) => (
        <Card key={n.id} onPress={() => navigation.navigate('NoteEditor', { noteId: n.id })}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Body style={{ fontFamily: t.fonts.bodySemi, flex: 1 }} numberOfLines={1}>{n.title}</Body>
            {n.itemId && itemName(n.itemId) ? <Badge text={itemName(n.itemId)!} tone="accent" /> : null}
          </Row>
          <Body small muted numberOfLines={2}>{n.body}</Body>
          <Body small muted style={{ color: t.colors.textFaint, marginTop: 4 }}>Modified {n.updatedAt.slice(0, 10)}</Body>
        </Card>
      ))}
    </Screen>
  );
}

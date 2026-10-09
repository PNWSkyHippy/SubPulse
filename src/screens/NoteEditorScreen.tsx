import React, { useState } from 'react';
import { Alert, Pressable } from 'react-native';
import { useSubscriptions } from '../context/SubscriptionsContext';
import { useTheme } from '../context/PreferencesContext';
import { Body, Button, Chip, ChipRow, Field, Heading, Icon, Input, Label, Row, Screen } from '../ui/kit';
import { exportToKeep, sendToGemini } from '../utils/noteExport';

export default function NoteEditorScreen({ navigation, route }: any) {
  const t = useTheme();
  const { notes, subscriptions, addNote, updateNote, deleteNote } = useSubscriptions();
  const existing = notes.find((n) => n.id === route.params?.noteId);
  const [title, setTitle] = useState(existing?.title ?? '');
  const [body, setBody] = useState(existing?.body ?? '');
  const [tags, setTags] = useState((existing?.tags ?? []).join(', '));
  const [itemId, setItemId] = useState<string | undefined>(existing?.itemId ?? route.params?.itemId);
  const item = subscriptions.find((s) => s.id === itemId);

  const values = () => ({ title: title.trim() || 'Untitled note', body: body.trim(), tags: tags.split(',').map((s) => s.trim()).filter(Boolean), itemId });

  const save = async () => {
    if (!title.trim() && !body.trim()) return Alert.alert('Empty note', 'Write something first.');
    const v = values();
    if (existing) await updateNote(existing.id, v);
    else await addNote(v);
    navigation.goBack();
  };

  return (
    <Screen>
      <Row>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <Icon name="chevron-left" size={26} color={t.colors.text} />
        </Pressable>
        <Heading size="md">{existing ? 'Edit note' : 'New note'}</Heading>
      </Row>
      <Field label="Title"><Input value={title} onChangeText={setTitle} placeholder="Lease renewal 2026" /></Field>
      <Field label="Note"><Input value={body} onChangeText={setBody} multiline style={{ minHeight: 180, textAlignVertical: 'top' }} placeholder="Landlord agreed to waive the parking fee if paid before the 3rd…" /></Field>
      <Field label="Tags (comma separated)"><Input value={tags} onChangeText={setTags} placeholder="tax, lease" autoCapitalize="none" /></Field>
      <Label>Attached to</Label>
      <ChipRow>
        <Chip label="Nothing" active={!itemId} onPress={() => setItemId(undefined)} />
        {subscriptions.slice(0, 40).map((s) => (
          <Chip key={s.id} label={s.name} active={itemId === s.id} onPress={() => setItemId(s.id)} />
        ))}
      </ChipRow>
      <Button icon="check-circle-outline" title="Save note" onPress={save} />
      <Row>
        <Button style={{ flex: 1 }} compact kind="warning" icon="lightbulb-outline" title="Export to Keep" onPress={() => exportToKeep(values(), item)} />
        <Button style={{ flex: 1 }} compact kind="secondary" icon="creation" title="Send to Gemini" onPress={() => sendToGemini(values(), item)} />
      </Row>
      <Body small muted>Keep and Gemini receive the note through Android's share intent; if the app isn't installed you'll get the share sheet instead.</Body>
      {existing ? (
        <Button
          kind="danger"
          compact
          icon="delete-outline"
          title="Delete note"
          onPress={() =>
            Alert.alert('Delete note?', existing.title, [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: async () => { await deleteNote(existing.id); navigation.goBack(); } },
            ])
          }
        />
      ) : null}
    </Screen>
  );
}

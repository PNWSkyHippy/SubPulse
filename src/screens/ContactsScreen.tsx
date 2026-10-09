import React, { useMemo, useState } from 'react';
import { Alert, Platform, Pressable, View } from 'react-native';
import * as Contacts from 'expo-contacts';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { useSubscriptions } from '../context/SubscriptionsContext';
import { useTheme } from '../context/PreferencesContext';
import { Avatar, Badge, Body, Button, Card, Field, Heading, Icon, Input, Row, Screen, SectionHeader } from '../ui/kit';
import { parseVCards } from '../utils/vcard';

/**
 * Contacts mesh: people used as payees (landlord, utility rep) and for split
 * billing. Import from the phone's address book — which includes Google
 * contacts synced to the device on Android — or from a .vcf file exported
 * from contacts.google.com.
 */
export default function ContactsScreen({ navigation }: any) {
  const t = useTheme();
  const { contacts, importContacts, addContact, deleteContact, subscriptions } = useSubscriptions();
  const [q, setQ] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  const list = useMemo(() => {
    const n = q.trim().toLowerCase();
    return [...contacts].filter((c) => !n || c.name.toLowerCase().includes(n) || (c.email ?? '').includes(n) || (c.phone ?? '').includes(n)).sort((a, b) => a.name.localeCompare(b.name));
  }, [contacts, q]);

  const usage = (id: string) => subscriptions.filter((s) => s.payeeContactId === id || s.splits?.some((x) => x.contactId === id)).length;

  const importDevice = async () => {
    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Permission needed', 'Allow contacts access to import from your phone.');
    setBusy(true);
    try {
      const { data } = await Contacts.getContactsAsync({ fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers, Contacts.Fields.Emails] });
      const rows = data
        .filter((c) => c.name)
        .map((c) => ({
          name: c.name!,
          phone: c.phoneNumbers?.[0]?.number,
          email: c.emails?.[0]?.email,
          source: 'device' as const,
          externalId: c.id,
        }));
      const added = await importContacts(rows);
      Alert.alert('Contacts imported', `${added} new contact${added === 1 ? '' : 's'} added (${rows.length - added} already present).`);
    } catch (e: any) {
      Alert.alert('Import failed', e?.message ?? 'Try again.');
    } finally {
      setBusy(false);
    }
  };

  const importVcf = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
    if (res.canceled || !res.assets?.[0]) return;
    setBusy(true);
    try {
      const text = await new File(res.assets[0].uri).text();
      const parsed = parseVCards(text);
      if (!parsed.length) return Alert.alert('No contacts found', 'That file did not contain any vCards.');
      const added = await importContacts(parsed.map((p) => ({ ...p, source: 'vcard' as const })));
      Alert.alert('Contacts imported', `${added} new of ${parsed.length} in file.`);
    } catch (e: any) {
      Alert.alert('Import failed', e?.message ?? 'Try another file.');
    } finally {
      setBusy(false);
    }
  };

  const addManual = async () => {
    if (!name.trim()) return Alert.alert('Name required');
    await addContact({ name: name.trim(), phone: phone.trim() || undefined, email: email.trim() || undefined, source: 'manual' });
    setName('');
    setPhone('');
    setEmail('');
  };

  return (
    <Screen>
      <Row>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <Icon name="chevron-left" size={26} color={t.colors.text} />
        </Pressable>
        <Heading size="md">Contacts mesh</Heading>
      </Row>
      <Card>
        <SectionHeader title="Import" icon="contacts-outline" right={<Badge text={`${contacts.length} mapped`} tone="accent" />} />
        <Body small muted style={{ marginVertical: 6 }}>
          {Platform.OS === 'android' ? 'Phone import includes Google contacts synced to this device. ' : ''}For Google Contacts on another device: contacts.google.com → Export → vCard, then import the .vcf here.
        </Body>
        <Row>
          <Button style={{ flex: 1 }} icon="cellphone" title="From phone" loading={busy} onPress={importDevice} />
          <Button style={{ flex: 1 }} kind="secondary" icon="google" title="vCard / Google" onPress={importVcf} />
        </Row>
      </Card>

      <Input value={q} onChangeText={setQ} placeholder="Search contacts" />
      {list.slice(0, 200).map((c) => (
        <Card key={c.id} style={{ paddingVertical: 10 }}>
          <Row>
            <Avatar name={c.name} size={34} />
            <View style={{ flex: 1 }}>
              <Body>{c.name}</Body>
              <Body small muted>{[c.phone, c.email].filter(Boolean).join(' · ') || c.source}</Body>
            </View>
            {usage(c.id) ? <Badge text={`${usage(c.id)} bills`} tone="accent" /> : null}
            <Pressable
              hitSlop={8}
              onPress={() =>
                Alert.alert('Remove contact?', c.name, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Remove', style: 'destructive', onPress: () => deleteContact(c.id) },
                ])
              }
            >
              <Icon name="delete-outline" size={18} />
            </Pressable>
          </Row>
        </Card>
      ))}
      {list.length > 200 ? <Body small muted>Showing 200 of {list.length}; search to narrow.</Body> : null}

      <Card>
        <SectionHeader title="Add manually" icon="plus" />
        <Field label="Name"><Input value={name} onChangeText={setName} placeholder="Marcus Vance (Landlord)" /></Field>
        <Field label="Phone"><Input value={phone} onChangeText={setPhone} keyboardType="phone-pad" /></Field>
        <Field label="Email"><Input value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" /></Field>
        <Button style={{ marginTop: 8 }} kind="secondary" title="Add contact" onPress={addManual} />
      </Card>
    </Screen>
  );
}

import React from 'react';
import { Pressable, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { usePreferences, useTheme } from '../context/PreferencesContext';
import { ACCENTS, AccentId, DEFAULT_THEME_SETTINGS, DepthId, PRESETS, PresetId, RADII, RadiusId, themeTokenJSON } from '../theme/theme';
import { Avatar, Badge, Body, Button, Card, Heading, Icon, Label, Metric, Row, Screen, SectionHeader, Segmented } from '../ui/kit';

export default function ThemeScreen({ navigation }: any) {
  const t = useTheme();
  const { themeSettings: s, setThemeSettings } = usePreferences();
  const set = (patch: Partial<typeof s>) => setThemeSettings({ ...s, ...patch });

  return (
    <Screen>
      <Row>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <Icon name="chevron-left" size={26} color={t.colors.text} />
        </Pressable>
        <View>
          <Label color={t.colors.accent}>Surface architecture</Label>
          <Heading size="lg">Stylist & Depth Lab</Heading>
        </View>
      </Row>

      <Label>Live preview</Label>
      <Card indicator={t.colors.accent}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Row>
            <Avatar name="Supabase Pro" size={36} />
            <View>
              <Body style={{ fontFamily: t.fonts.bodySemi }}>Supabase Pro Tier</Body>
              <Body small muted>Auto-renews Oct 28 · Cloud</Body>
            </View>
          </Row>
          <Badge text="Active" tone="ok" />
        </Row>
        <Row style={{ justifyContent: 'space-between', marginTop: 10 }}>
          <View>
            <Label>Monthly burn</Label>
            <Metric size={26}>$25.00</Metric>
          </View>
          <Button compact title="Manage" onPress={() => {}} />
        </Row>
      </Card>

      <SectionHeader title="Curated design presets" right="1-click apply" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {(Object.keys(PRESETS) as PresetId[]).map((id) => {
          const p = PRESETS[id];
          const active = s.preset === id;
          return (
            <Pressable
              key={id}
              onPress={() => set({ preset: id, accent: p.defaultAccent, radius: p.defaultRadius })}
              style={{ width: '48.6%', backgroundColor: p.surface1, borderRadius: 8, borderWidth: 1, borderColor: active ? t.colors.accent : 'rgba(255,255,255,0.08)', padding: 12, gap: 4 }}
            >
              <Row style={{ justifyContent: 'space-between' }}>
                <Body small style={{ fontFamily: t.fonts.bodySemi }}>{p.label}</Body>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: ACCENTS[p.defaultAccent].color }} />
              </Row>
              <Body small muted>{p.blurb}</Body>
            </Pressable>
          );
        })}
      </View>

      <SectionHeader title="Accent & illumination" icon="palette-outline" />
      <Row style={{ justifyContent: 'space-between' }}>
        {(Object.keys(ACCENTS) as AccentId[]).map((id) => (
          <Pressable key={id} onPress={() => set({ accent: id })} style={{ alignItems: 'center', gap: 4, flex: 1 }}>
            <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: ACCENTS[id].color, borderWidth: s.accent === id ? 3 : 0, borderColor: '#fff' }} />
            <Body small muted>{ACCENTS[id].label}</Body>
          </Pressable>
        ))}
      </Row>

      <SectionHeader title="Tactile depth engine" />
      <Segmented<DepthId>
        value={s.depth}
        onChange={(depth) => set({ depth })}
        options={[
          { value: 'flat', label: 'Flat' },
          { value: 'lined', label: 'Lined' },
          { value: 'raised', label: 'Raised 3D' },
          { value: 'sunken', label: 'Sunken' },
        ]}
      />

      <SectionHeader title="Corner radius archetype" />
      <Segmented<RadiusId> value={s.radius} onChange={(radius) => set({ radius })} options={(Object.keys(RADII) as RadiusId[]).map((r) => ({ value: r, label: RADII[r].label.split(' ')[0] }))} />

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Label>Generated token string (MCP live spec)</Label>
          <Pressable onPress={() => Clipboard.setStringAsync(themeTokenJSON(t))}>
            <Label color={t.colors.accent}>Copy JSON</Label>
          </Pressable>
        </Row>
        <Body small muted style={{ marginTop: 6 }}>{themeTokenJSON(t)}</Body>
      </Card>

      <Row>
        <Button style={{ flex: 1 }} icon="check-circle-outline" title="Done" onPress={() => navigation.goBack()} />
        <Button kind="secondary" icon="restore" title="Reset" onPress={() => setThemeSettings(DEFAULT_THEME_SETTINGS)} />
      </Row>
    </Screen>
  );
}

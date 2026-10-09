import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/PreferencesContext';
import { getColorForName, getInitials } from '../utils/subscriptionIcon';

export type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

export function Icon({ name, size = 20, color, style }: { name: IconName; size?: number; color?: string; style?: StyleProp<TextStyle> }) {
  const t = useTheme();
  return <MaterialCommunityIcons name={name} size={size} color={color ?? t.colors.textMuted} style={style} />;
}

/** Full-screen canvas with safe-area padding and optional scrolling. */
export function Screen({
  children,
  scroll = true,
  padded = true,
  footer,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  footer?: React.ReactNode;
}) {
  const t = useTheme();
  const pad = padded ? { padding: 16, paddingBottom: 32, gap: 12 } : undefined;
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.colors.canvas }}>
      {scroll ? (
        <ScrollView contentContainerStyle={pad} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, pad]}>{children}</View>
      )}
      {footer}
    </SafeAreaView>
  );
}

/** "SubPulse • SECTION" header used at the top of every tab, per the Stitch screens. */
export function AppHeader({ section, right }: { section: string; right?: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={styles.headerRow}>
      <View style={[styles.logo, { backgroundColor: t.colors.accent, borderRadius: Math.min(t.radius.card, 8) }]}>
        <Icon name="pulse" size={18} color={t.colors.onAccent} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ color: t.colors.text, fontFamily: t.fonts.headingBold, fontSize: 18 }}>SubPulse</Text>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: t.colors.accent }} />
        </View>
        <Text style={[styles.micro, { color: t.colors.textMuted, fontFamily: t.fonts.bodySemi }]}>{section.toUpperCase()}</Text>
      </View>
      {right}
    </View>
  );
}

export function Card({
  children,
  style,
  tier = 1,
  indicator,
  onPress,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  tier?: 1 | 2 | 3;
  /** 2px leading status bar color (emerald/amber/crimson) */
  indicator?: string;
  onPress?: () => void;
}) {
  const t = useTheme();
  const bg = tier === 1 ? t.colors.surface1 : tier === 2 ? t.colors.surface2 : t.colors.surface3;
  const border = tier === 3 ? t.colors.accentBorder : tier === 2 ? t.colors.borderStrong : t.colors.border;
  const base: ViewStyle = {
    backgroundColor: bg,
    borderColor: border,
    borderWidth: t.borderWidth,
    borderRadius: t.radius.card,
    padding: 14,
    elevation: t.elevation,
    overflow: 'hidden',
  };
  const content = (
    <>
      {indicator ? <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 2, backgroundColor: indicator }} /> : null}
      {children}
    </>
  );
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [base, style, pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] }]}>
        {content}
      </Pressable>
    );
  }
  return <View style={[base, style]}>{content}</View>;
}

/** Uppercase, tracked micro label (label-sm / label-md). */
export function Label({ children, color, style }: { children: React.ReactNode; color?: string; style?: StyleProp<TextStyle> }) {
  const t = useTheme();
  return <Text style={[styles.micro, { color: color ?? t.colors.textMuted, fontFamily: t.fonts.bodySemi }, style]}>{typeof children === 'string' ? children.toUpperCase() : children}</Text>;
}

export function Heading({ children, size = 'md', style }: { children: React.ReactNode; size?: 'xl' | 'lg' | 'md' | 'sm'; style?: StyleProp<TextStyle> }) {
  const t = useTheme();
  const fs = { xl: 28, lg: 22, md: 18, sm: 15 }[size];
  return <Text style={[{ color: t.colors.text, fontFamily: size === 'xl' ? t.fonts.headingBold : t.fonts.heading, fontSize: fs, letterSpacing: -0.3 }, style]}>{children}</Text>;
}

export function Body({ children, muted, small, style, numberOfLines }: { children: React.ReactNode; muted?: boolean; small?: boolean; style?: StyleProp<TextStyle>; numberOfLines?: number }) {
  const t = useTheme();
  return (
    <Text numberOfLines={numberOfLines} style={[{ color: muted ? t.colors.textMuted : t.colors.text, fontFamily: t.fonts.body, fontSize: small ? 12 : 14, lineHeight: small ? 16 : 20 }, style]}>
      {children}
    </Text>
  );
}

/** Tabular-figure money/metric text. */
export function Metric({ children, size = 32, color, style }: { children: React.ReactNode; size?: number; color?: string; style?: StyleProp<TextStyle> }) {
  const t = useTheme();
  return (
    <Text style={[{ color: color ?? t.colors.text, fontFamily: t.fonts.bodySemi, fontSize: size, letterSpacing: -0.8, fontVariant: ['tabular-nums'] }, style]}>
      {children}
    </Text>
  );
}

type ButtonKind = 'primary' | 'secondary' | 'danger' | 'ghost' | 'warning';

export function Button({
  title,
  onPress,
  kind = 'primary',
  icon,
  disabled,
  loading,
  style,
  compact,
}: {
  title: string;
  onPress: () => void;
  kind?: ButtonKind;
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
}) {
  const t = useTheme();
  const palette: Record<ButtonKind, { bg: string; fg: string; border: string }> = {
    primary: { bg: t.colors.accent, fg: t.colors.onAccent, border: t.colors.accent },
    secondary: { bg: t.colors.surface2, fg: t.colors.text, border: 'rgba(255,255,255,0.08)' },
    danger: { bg: t.colors.dangerSoft, fg: t.colors.danger, border: t.colors.dangerBorder },
    warning: { bg: t.colors.warning, fg: '#140C00', border: t.colors.warning },
    ghost: { bg: 'transparent', fg: t.colors.accent, border: 'transparent' },
  };
  const c = palette[kind];
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        {
          backgroundColor: c.bg,
          borderColor: c.border,
          borderWidth: 1,
          borderRadius: t.radius.control,
          paddingVertical: compact ? 8 : 12,
          paddingHorizontal: compact ? 10 : 14,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          opacity: disabled ? 0.45 : 1,
        },
        pressed && { transform: [{ scale: 0.98 }] },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={c.fg} size="small" /> : icon ? <Icon name={icon} size={compact ? 16 : 18} color={c.fg} /> : null}
      <Text style={{ color: c.fg, fontFamily: t.fonts.bodySemi, fontSize: compact ? 13 : 15 }}>{title}</Text>
    </Pressable>
  );
}

export type BadgeTone = 'ok' | 'warn' | 'danger' | 'neutral' | 'accent';

export function Badge({ text, tone = 'neutral' }: { text: string; tone?: BadgeTone }) {
  const t = useTheme();
  const map: Record<BadgeTone, { bg: string; fg: string; border: string }> = {
    ok: { bg: t.colors.accentSoft, fg: t.colors.accent, border: t.colors.accentBorder },
    accent: { bg: t.colors.accentSoft, fg: t.colors.accent, border: t.colors.accentBorder },
    warn: { bg: t.colors.warningSoft, fg: t.colors.warning, border: 'rgba(255,178,36,0.2)' },
    danger: { bg: 'rgba(255,92,92,0.1)', fg: t.colors.danger, border: 'rgba(255,92,92,0.2)' },
    neutral: { bg: t.colors.surface2, fg: t.colors.textMuted, border: t.colors.border },
  };
  const c = map[tone];
  return (
    <View style={{ backgroundColor: c.bg, borderColor: c.border, borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' }}>
      <Text style={{ color: c.fg, fontFamily: t.fonts.bodySemi, fontSize: 10, letterSpacing: 0.6 }}>{text.toUpperCase()}</Text>
    </View>
  );
}

export function Chip({ label, active, onPress, icon }: { label: string; active?: boolean; onPress: () => void; icon?: IconName }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 999,
        backgroundColor: active ? t.colors.accent : t.colors.surface2,
        borderWidth: 1,
        borderColor: active ? t.colors.accent : t.colors.border,
      }}
    >
      {icon ? <Icon name={icon} size={14} color={active ? t.colors.onAccent : t.colors.textMuted} /> : null}
      <Text style={{ color: active ? t.colors.onAccent : t.colors.textMuted, fontFamily: t.fonts.bodyMedium, fontSize: 12 }}>{label}</Text>
    </Pressable>
  );
}

export function ChipRow({ children, scroll = true }: { children: React.ReactNode; scroll?: boolean }) {
  if (!scroll) return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{children}</View>;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {children}
    </ScrollView>
  );
}

export function Field({ label, required, children, hint }: { label: string; required?: boolean; children: React.ReactNode; hint?: string }) {
  const t = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Label>{label}</Label>
        {required ? <Label color={t.colors.accent}>* required</Label> : null}
      </View>
      {children}
      {hint ? <Body small muted>{hint}</Body> : null}
    </View>
  );
}

export function Input(props: TextInputProps & { mono?: boolean }) {
  const t = useTheme();
  const [focused, setFocused] = React.useState(false);
  const { mono, style, ...rest } = props;
  return (
    <TextInput
      placeholderTextColor={t.colors.textFaint}
      {...rest}
      onFocus={(e) => {
        setFocused(true);
        rest.onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        rest.onBlur?.(e);
      }}
      style={[
        {
          minHeight: 44,
          backgroundColor: t.colors.surface1,
          borderWidth: 1,
          borderColor: focused ? t.colors.accent : 'rgba(255,255,255,0.08)',
          borderRadius: t.radius.control,
          color: t.colors.text,
          paddingHorizontal: 12,
          paddingVertical: 10,
          fontFamily: t.fonts.body,
          fontSize: 15,
          fontVariant: mono ? ['tabular-nums'] : undefined,
        },
        style,
      ]}
    />
  );
}

export function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: t.colors.surface1, borderRadius: t.radius.control, borderWidth: 1, borderColor: t.colors.border, padding: 3, gap: 3 }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={{ flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: Math.max(0, t.radius.control - 2), backgroundColor: active ? t.colors.accent : 'transparent' }}
          >
            <Text numberOfLines={1} style={{ color: active ? t.colors.onAccent : t.colors.textMuted, fontFamily: t.fonts.bodySemi, fontSize: 12 }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function SectionHeader({ title, right, icon }: { title: string; right?: React.ReactNode; icon?: IconName }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {icon ? <Icon name={icon} size={18} color={t.colors.accent} /> : null}
        <Heading size="sm">{title}</Heading>
      </View>
      {typeof right === 'string' ? <Label>{right}</Label> : right}
    </View>
  );
}

export function Row({ children, style, gap = 8 }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

export function Divider() {
  const t = useTheme();
  return <View style={{ height: 1, backgroundColor: t.colors.divider, marginVertical: 4 }} />;
}

export function ToggleRow({ title, subtitle, value, onChange, disabled }: { title: string; subtitle?: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  const t = useTheme();
  return (
    <Row style={{ justifyContent: 'space-between', paddingVertical: 6 }}>
      <View style={{ flex: 1 }}>
        <Body>{title}</Body>
        {subtitle ? <Body small muted>{subtitle}</Body> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ true: t.colors.accent, false: t.colors.surface3 }}
        thumbColor={value ? t.colors.onAccent : '#888'}
      />
    </Row>
  );
}

/** Square avatar with generated initials (no brand logos). */
export function Avatar({ name, size = 40, icon }: { name: string; size?: number; icon?: IconName }) {
  const t = useTheme();
  const color = getColorForName(name);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: Math.min(t.radius.card, size / 2),
        backgroundColor: color + '26',
        borderWidth: 1,
        borderColor: color + '55',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {icon ? <Icon name={icon} size={size * 0.5} color={color} /> : <Text style={{ color, fontFamily: t.fonts.bodySemi, fontSize: size * 0.36 }}>{getInitials(name)}</Text>}
    </View>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: IconName; title: string; body?: string; action?: React.ReactNode }) {
  const t = useTheme();
  return (
    <Card style={{ alignItems: 'center', paddingVertical: 28, gap: 8 }}>
      <Icon name={icon} size={32} color={t.colors.accent} />
      <Heading size="sm">{title}</Heading>
      {body ? <Body muted style={{ textAlign: 'center' }}>{body}</Body> : null}
      {action}
    </Card>
  );
}

export function Loading() {
  const t = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: t.colors.canvas, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={t.colors.accent} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  logo: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  micro: { fontSize: 10.5, letterSpacing: 0.9 },
});

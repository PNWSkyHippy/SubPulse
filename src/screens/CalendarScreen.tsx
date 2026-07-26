import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useSubscriptions } from '../context/SubscriptionsContext';
import { getMonthGrid, groupSubscriptionsByRenewalDate, formatISODate } from '../utils/dateHelpers';
import { formatCurrency } from '../utils/currency';
import SubscriptionIcon from '../components/SubscriptionIcon';

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function CalendarScreen({ navigation }: any) {
  const { subscriptions } = useSubscriptions();
  const today = useMemo(() => new Date(), []);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-indexed

  const grid = useMemo(() => getMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);
  const renewalsByDate = useMemo(() => groupSubscriptionsByRenewalDate(subscriptions), [subscriptions]);

  const todayKey = formatISODate(today);
  const isCurrentMonth = viewYear === today.getFullYear() && viewMonth === today.getMonth();

  const goToPrevMonth = () => {
    if (viewMonth === 0) {
      setViewYear(viewYear - 1);
      setViewMonth(11);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (viewMonth === 11) {
      setViewYear(viewYear + 1);
      setViewMonth(0);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  // Upcoming payments: everything in the currently-viewed month, in date order.
  const upcomingInMonth = Object.keys(renewalsByDate)
    .filter((dateKey) => {
      const [y, m] = dateKey.split('-').map(Number);
      return y === viewYear && m - 1 === viewMonth;
    })
    .sort()
    .flatMap((dateKey) => renewalsByDate[dateKey].map((sub) => ({ sub, dateKey })));

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
      <View style={styles.calendarCard}>
        <View style={styles.monthHeader}>
          <Pressable onPress={goToPrevMonth} hitSlop={12}>
            <Text style={styles.navArrow}>‹</Text>
          </Pressable>
          <Text style={styles.monthTitle}>{MONTH_NAMES[viewMonth]} {viewYear}</Text>
          <Pressable onPress={goToNextMonth} hitSlop={12}>
            <Text style={styles.navArrow}>›</Text>
          </Pressable>
        </View>

        <View style={styles.weekdayRow}>
          {WEEKDAY_LABELS.map((label, idx) => (
            <Text key={idx} style={styles.weekdayLabel}>{label}</Text>
          ))}
        </View>

        {grid.map((week, weekIdx) => (
          <View key={weekIdx} style={styles.weekRow}>
            {week.map((day, dayIdx) => {
              if (day === null) return <View key={dayIdx} style={styles.dayCell} />;
              const dateKey = formatISODate(new Date(Date.UTC(viewYear, viewMonth, day)));
              const hasRenewal = !!renewalsByDate[dateKey];
              const isToday = isCurrentMonth && dateKey === todayKey;
              return (
                <View key={dayIdx} style={styles.dayCell}>
                  <View style={[styles.dayCircle, isToday && styles.dayCircleToday]}>
                    <Text style={[styles.dayText, isToday && styles.dayTextToday]}>{day}</Text>
                  </View>
                  {hasRenewal && <View style={styles.renewalDot} />}
                </View>
              );
            })}
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>
        {isCurrentMonth ? 'Upcoming Payments' : `Payments in ${MONTH_NAMES[viewMonth]}`}
      </Text>

      {upcomingInMonth.length === 0 ? (
        <Text style={styles.empty}>No renewals this month.</Text>
      ) : (
        upcomingInMonth.map(({ sub, dateKey }) => (
          <Pressable
            key={sub.id}
            style={styles.paymentRow}
            onPress={() => navigation.navigate('SubscriptionDetail', { id: sub.id })}
          >
            <SubscriptionIcon name={sub.name} size={36} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.paymentName}>{sub.name}</Text>
              <Text style={styles.paymentDate}>{dateKey}</Text>
            </View>
            <Text style={styles.paymentCost}>{formatCurrency(sub.cost, sub.currency)}</Text>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  calendarCard: { backgroundColor: '#1E293B', borderRadius: 16, padding: 16 },
  monthHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  navArrow: { color: '#F8FAFC', fontSize: 24, paddingHorizontal: 12 },
  monthTitle: { color: '#F8FAFC', fontSize: 17, fontWeight: '700' },
  weekdayRow: { flexDirection: 'row', marginBottom: 4 },
  weekdayLabel: { flex: 1, textAlign: 'center', color: '#64748B', fontSize: 12, fontWeight: '600' },
  weekRow: { flexDirection: 'row' },
  dayCell: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  dayCircle: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  dayCircleToday: { backgroundColor: '#6366F1' },
  dayText: { color: '#CBD5E1', fontSize: 13 },
  dayTextToday: { color: '#fff', fontWeight: '700' },
  renewalDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#FBBF24', marginTop: 2 },
  sectionTitle: { color: '#F8FAFC', fontSize: 18, fontWeight: '700', marginTop: 24, marginBottom: 12 },
  empty: { color: '#94A3B8' },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  paymentName: { color: '#F8FAFC', fontSize: 15, fontWeight: '600' },
  paymentDate: { color: '#94A3B8', fontSize: 12, marginTop: 2 },
  paymentCost: { color: '#F8FAFC', fontSize: 15, fontWeight: '700' },
});

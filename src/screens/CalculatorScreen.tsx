import React from 'react';
import { Alert, Pressable } from 'react-native';
import { useSubscriptions } from '../context/SubscriptionsContext';
import { useTheme } from '../context/PreferencesContext';
import Calculator from '../components/Calculator';
import { Heading, Icon, Row, Screen } from '../ui/kit';
import { formatCurrency } from '../utils/currency';

export default function CalculatorScreen({ navigation, route }: any) {
  const t = useTheme();
  const { subscriptions, updateSubscription } = useSubscriptions();
  const item = subscriptions.find((s) => s.id === route?.params?.itemId);
  return (
    <Screen>
      <Row>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <Icon name="chevron-left" size={26} color={t.colors.text} />
        </Pressable>
        <Heading size="md">{item ? `Calculator · ${item.name}` : 'Calculator'}</Heading>
      </Row>
      <Calculator
        initialValue={route?.params?.initial ?? item?.cost}
        onApply={
          item
            ? (v) =>
                Alert.alert('Update amount?', `Set ${item.name} to ${formatCurrency(v, item.currency)}?`, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Update', onPress: async () => { await updateSubscription(item.id, { cost: v }); navigation.goBack(); } },
                ])
            : undefined
        }
        applyLabel="Set as amount"
      />
    </Screen>
  );
}

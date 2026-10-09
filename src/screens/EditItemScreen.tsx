import React from 'react';
import { Pressable } from 'react-native';
import { useSubscriptions } from '../context/SubscriptionsContext';
import { useTheme } from '../context/PreferencesContext';
import ItemForm from '../components/ItemForm';
import { EmptyState, Heading, Icon, Row, Screen } from '../ui/kit';

export default function EditItemScreen({ route, navigation }: any) {
  const t = useTheme();
  const { subscriptions, updateSubscription } = useSubscriptions();
  const item = subscriptions.find((s) => s.id === route.params.id);
  if (!item) return <Screen><EmptyState icon="close-circle-outline" title="Entry not found" /></Screen>;
  const { id, ownerId, createdAt, ...initial } = item;
  return (
    <Screen>
      <Row>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <Icon name="chevron-left" size={26} color={t.colors.text} />
        </Pressable>
        <Heading size="md">Edit {item.name}</Heading>
      </Row>
      <ItemForm
        initial={initial}
        submitLabel="Save changes"
        onSubmit={async (values) => {
          // Fields cleared in the form arrive as undefined and are deleted from the document.
          await updateSubscription(id, values);
          navigation.goBack();
        }}
      />
    </Screen>
  );
}

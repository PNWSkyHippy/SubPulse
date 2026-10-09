import React, { useEffect, useRef } from 'react';
import { DarkTheme, NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useFonts } from 'expo-font';
import { HankenGrotesk_600SemiBold, HankenGrotesk_700Bold } from '@expo-google-fonts/hanken-grotesk';
import { Geist_400Regular, Geist_500Medium, Geist_600SemiBold } from '@expo-google-fonts/geist';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import { SubscriptionsProvider, useSubscriptions } from './src/context/SubscriptionsContext';
import { PreferencesProvider, usePreferences, useTheme } from './src/context/PreferencesContext';
import { SecurityProvider, useSecurity } from './src/context/SecurityContext';
import LockScreen, { PrivacyCover } from './src/screens/LockScreen';
import SecurityScreen from './src/screens/SecurityScreen';
import { Icon, IconName, Loading } from './src/ui/kit';
import { RootStackParamList, TabParamList } from './src/navigation/types';
import { ACTION_MARK_PAID, ACTION_SNOOZE, requestNotificationPermission, snoozeItem } from './src/utils/notifications';
import { initAds } from './src/utils/ad';

import LoginScreen from './src/screens/LoginScreen';
import SignupScreen from './src/screens/SignupScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import AddScreen from './src/screens/AddScreen';
import OptimizerScreen from './src/screens/OptimizerScreen';
import InspectScreen from './src/screens/InspectScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import ItemDetailScreen from './src/screens/ItemDetailScreen';
import EditItemScreen from './src/screens/EditItemScreen';
import CalculatorScreen from './src/screens/CalculatorScreen';
import NotesScreen from './src/screens/NotesScreen';
import NoteEditorScreen from './src/screens/NoteEditorScreen';
import ContactsScreen from './src/screens/ContactsScreen';
import CurrencyScreen from './src/screens/CurrencyScreen';
import ThemeScreen from './src/screens/ThemeScreen';
import PaywallScreen from './src/screens/PaywallScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import BalancesScreen from './src/screens/BalancesScreen';
import GatewayScreen from './src/screens/GatewayScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

const TAB_ICONS: Record<keyof TabParamList, IconName> = {
  Dashboard: 'view-dashboard-outline',
  Add: 'plus-circle-outline',
  Optimizer: 'creation',
  Inspect: 'magnify-scan',
  Settings: 'cog-outline',
};
const TAB_LABELS: Record<keyof TabParamList, string> = {
  Dashboard: 'Dashboard',
  Add: 'Add & CSV',
  Optimizer: 'Optimizer',
  Inspect: 'Inspect',
  Settings: 'Settings',
};

function Tabs() {
  const t = useTheme();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: t.colors.accent,
        tabBarInactiveTintColor: t.colors.textMuted,
        tabBarStyle: { backgroundColor: t.colors.canvas, borderTopColor: t.colors.border, height: 64, paddingBottom: 8, paddingTop: 6 },
        tabBarLabelStyle: { fontFamily: t.fonts.bodyMedium, fontSize: 11 },
        tabBarLabel: TAB_LABELS[route.name],
        tabBarIcon: ({ color }) => <Icon name={TAB_ICONS[route.name]} color={color} size={22} />,
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Add" component={AddScreen} />
      <Tab.Screen name="Optimizer" component={OptimizerScreen} />
      <Tab.Screen name="Inspect" component={InspectScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

/** Handles taps on reminder notifications and their "Mark paid" / "Remind tomorrow" buttons. */
function NotificationActions() {
  const { subscriptions, recordPayment } = useSubscriptions();
  const subsRef = useRef(subscriptions);
  subsRef.current = subscriptions;
  const handled = useRef(new Set<string>());

  useEffect(() => {
    requestNotificationPermission().catch(() => {});
    const handle = async (response: Notifications.NotificationResponse) => {
      const key = response.notification.request.identifier + response.actionIdentifier;
      if (handled.current.has(key)) return;
      handled.current.add(key);
      const itemId = response.notification.request.content.data?.itemId as string | undefined;
      if (!itemId) return;
      const item = subsRef.current.find((s) => s.id === itemId);
      if (response.actionIdentifier === ACTION_MARK_PAID && item) {
        await recordPayment(itemId).catch(() => {});
      } else if (response.actionIdentifier === ACTION_SNOOZE && item) {
        await snoozeItem(item).catch(() => {});
      } else if (navigationRef.isReady()) {
        navigationRef.navigate('ItemDetail', { id: itemId });
      }
    };
    const sub = Notifications.addNotificationResponseReceivedListener(handle);
    // Cold start from a notification tap.
    Notifications.getLastNotificationResponseAsync().then((r) => r && handle(r)).catch(() => {});
    return () => sub.remove();
    // recordPayment identity changes with data; the ref keeps the latest list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscriptions.length > 0]);
  return null;
}

function RootNavigator() {
  const { user, initializing } = useAuth();
  const { ready } = usePreferences();
  const security = useSecurity();
  const t = useTheme();

  if (initializing || !ready || !security.ready) return <Loading />;

  const navTheme = {
    ...DarkTheme,
    colors: { ...DarkTheme.colors, background: t.colors.canvas, card: t.colors.canvas, primary: t.colors.accent, text: t.colors.text, border: t.colors.border },
  };

  return (
    <NavigationContainer ref={navigationRef} theme={navTheme} linking={{ prefixes: ['subpulse://'], config: { screens: { ItemDetail: 'item/:id', Balances: 'stripe-linked' } } }}>
      {user ? <NotificationActions /> : null}
      <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.colors.canvas } }}>
        {user ? (
          <Stack.Group>
            <Stack.Screen name="Tabs" component={Tabs} />
            <Stack.Screen name="ItemDetail" component={ItemDetailScreen} />
            <Stack.Screen name="EditItem" component={EditItemScreen} />
            <Stack.Screen name="Calculator" component={CalculatorScreen} />
            <Stack.Screen name="Notes" component={NotesScreen} />
            <Stack.Screen name="NoteEditor" component={NoteEditorScreen} />
            <Stack.Screen name="Contacts" component={ContactsScreen} />
            <Stack.Screen name="Currency" component={CurrencyScreen} />
            <Stack.Screen name="Theme" component={ThemeScreen} />
            <Stack.Screen name="Calendar" component={CalendarScreen} />
            <Stack.Screen name="Balances" component={BalancesScreen} />
            <Stack.Screen name="Gateway" component={GatewayScreen} />
            <Stack.Screen name="Security" component={SecurityScreen} />
            <Stack.Screen name="Paywall" component={PaywallScreen} options={{ presentation: 'modal' }} />
          </Stack.Group>
        ) : (
          <Stack.Group>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Signup" component={SignupScreen} />
          </Stack.Group>
        )}
      </Stack.Navigator>
      {/* The app stays mounted underneath so state survives locking. */}
      {security.locked ? (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
          <LockScreen />
        </View>
      ) : null}
      {security.obscured && !security.locked ? <PrivacyCover /> : null}
    </NavigationContainer>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({ HankenGrotesk_600SemiBold, HankenGrotesk_700Bold, Geist_400Regular, Geist_500Medium, Geist_600SemiBold });

  useEffect(() => {
    initAds();
  }, []);

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <PreferencesProvider>
          <SecurityProvider>
            <SubscriptionsProvider>
              <StatusBar style="light" />
              <RootNavigator />
            </SubscriptionsProvider>
          </SecurityProvider>
        </PreferencesProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

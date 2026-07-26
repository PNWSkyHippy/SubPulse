import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import { SubscriptionsProvider } from './src/context/SubscriptionsContext';

import LoginScreen from './src/screens/LoginScreen';
import SignupScreen from './src/screens/SignupScreen';
import HomeScreen from './src/screens/HomeScreen';
import AddSubscriptionScreen from './src/screens/AddSubscriptionScreen';
import SubscriptionDetailScreen from './src/screens/SubscriptionDetailScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import InsightsScreen from './src/screens/InsightsScreen';

const Stack = createNativeStackNavigator();

function RootNavigator() {
  const { user, initializing } = useAuth();

  if (initializing) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F172A' }}>
        <ActivityIndicator color="#6366F1" size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <Stack.Group>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="AddSubscription" component={AddSubscriptionScreen} options={{ headerShown: true, title: 'Add Subscription' }} />
            <Stack.Screen name="SubscriptionDetail" component={SubscriptionDetailScreen} options={{ headerShown: true, title: 'Details' }} />
            <Stack.Screen name="Calendar" component={CalendarScreen} options={{ headerShown: true, title: 'Calendar' }} />
            <Stack.Screen name="Insights" component={InsightsScreen} options={{ headerShown: true, title: 'Insights' }} />
          </Stack.Group>
        ) : (
          <Stack.Group>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Signup" component={SignupScreen} />
          </Stack.Group>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SubscriptionsProvider>
        <StatusBar style="light" />
        <RootNavigator />
      </SubscriptionsProvider>
    </AuthProvider>
  );
}

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { buildTheme, DEFAULT_THEME_SETTINGS, Theme, ThemeSettings } from '../theme/theme';
import { getRates, RateTable } from '../utils/forex';
import { configurePurchases, hasPremiumEntitlement } from '../utils/purchases';
import { useAuth } from './AuthContext';

/**
 * Device-local preferences: theme, base currency, gateway URL, and the
 * premium (ad-free) entitlement. Stored in AsyncStorage (per device), not
 * Firestore, so a theme experiment on one phone doesn't repaint another.
 */
interface PreferencesValue {
  theme: Theme;
  themeSettings: ThemeSettings;
  setThemeSettings: (s: ThemeSettings) => void;
  baseCurrency: string;
  setBaseCurrency: (c: string) => void;
  rates: RateTable | null;
  refreshRates: () => Promise<void>;
  /** URL of the deployed SubPulse gateway (MCP + Stripe). Empty = not configured. */
  gatewayUrl: string;
  setGatewayUrl: (u: string) => void;
  isPremium: boolean;
  refreshPremium: () => Promise<void>;
  ready: boolean;
}

const PreferencesContext = createContext<PreferencesValue | undefined>(undefined);

const KEYS = { theme: 'pref:theme', currency: 'pref:baseCurrency', gateway: 'pref:gatewayUrl' };
const DEFAULT_GATEWAY = process.env.EXPO_PUBLIC_GATEWAY_URL ?? '';

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [themeSettings, setThemeState] = useState<ThemeSettings>(DEFAULT_THEME_SETTINGS);
  const [baseCurrency, setCurrencyState] = useState('USD');
  const [gatewayUrl, setGatewayState] = useState(DEFAULT_GATEWAY);
  const [rates, setRates] = useState<RateTable | null>(null);
  const [isPremium, setPremium] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [t, c, g] = await Promise.all([AsyncStorage.getItem(KEYS.theme), AsyncStorage.getItem(KEYS.currency), AsyncStorage.getItem(KEYS.gateway)]);
        if (t) setThemeState({ ...DEFAULT_THEME_SETTINGS, ...JSON.parse(t) });
        if (c) setCurrencyState(c);
        if (g) setGatewayState(g);
      } catch {
        /* defaults */
      }
      setReady(true);
    })();
  }, []);

  const setThemeSettings = (s: ThemeSettings) => {
    setThemeState(s);
    AsyncStorage.setItem(KEYS.theme, JSON.stringify(s)).catch(() => {});
  };
  const setBaseCurrency = (c: string) => {
    setCurrencyState(c);
    AsyncStorage.setItem(KEYS.currency, c).catch(() => {});
  };
  const setGatewayUrl = (u: string) => {
    const v = u.trim().replace(/\/+$/, '');
    setGatewayState(v);
    AsyncStorage.setItem(KEYS.gateway, v).catch(() => {});
  };

  const refreshRates = useCallback(async () => {
    setRates(await getRates(baseCurrency, AsyncStorage));
  }, [baseCurrency]);
  useEffect(() => {
    refreshRates();
  }, [refreshRates]);

  const refreshPremium = useCallback(async () => {
    try {
      setPremium(await hasPremiumEntitlement());
    } catch {
      setPremium(false); // RevenueCat not configured yet (no API keys) -> free tier
    }
  }, []);
  useEffect(() => {
    if (!user) return;
    configurePurchases(user.uid);
    refreshPremium();
  }, [user, refreshPremium]);

  const theme = useMemo(() => buildTheme(themeSettings), [themeSettings]);

  return (
    <PreferencesContext.Provider
      value={{
        theme,
        themeSettings,
        setThemeSettings,
        baseCurrency,
        setBaseCurrency,
        rates,
        refreshRates,
        gatewayUrl,
        setGatewayUrl,
        isPremium,
        refreshPremium,
        ready,
      }}
    >
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences(): PreferencesValue {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used within a PreferencesProvider');
  return ctx;
}

export function useTheme(): Theme {
  return usePreferences().theme;
}

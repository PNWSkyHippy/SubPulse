import React, { useEffect, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import type { PurchasesOffering, PurchasesPackage } from 'react-native-purchases';
import { usePreferences, useTheme } from '../context/PreferencesContext';
import { Badge, Body, Button, Card, Heading, Icon, Label, Metric, Row, Screen } from '../ui/kit';
import { getCurrentOffering, purchasePackage, purchasesConfigured, restorePurchases, PREMIUM_ENTITLEMENT_ID } from '../utils/purchases';
import { friendlyError } from '../utils/errors';

const PERKS = ['100% ad-free — no banners or interstitials', 'Supports ongoing development', 'One purchase covers all your devices (same account)'];

export default function PaywallScreen({ navigation }: any) {
  const t = useTheme();
  const { isPremium, refreshPremium } = usePreferences();
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    getCurrentOffering().then(setOffering).catch(() => setOffering(null));
  }, []);

  const buy = async (pkg: PurchasesPackage) => {
    setBusy(pkg.identifier);
    try {
      const info = await purchasePackage(pkg);
      if (info.entitlements.active[PREMIUM_ENTITLEMENT_ID]) {
        await refreshPremium();
        Alert.alert('Welcome to Pro', 'Ads are gone. Thanks for supporting SubPulse!');
        navigation.goBack();
      }
    } catch (e: any) {
      if (!e?.userCancelled) Alert.alert('Purchase failed', friendlyError(e));
    } finally {
      setBusy(null);
    }
  };

  const restore = async () => {
    setBusy('restore');
    try {
      await restorePurchases();
      await refreshPremium();
      Alert.alert('Restore complete', 'Any previous purchase has been restored.');
    } catch (e: any) {
      Alert.alert('Restore failed', friendlyError(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen>
      <Row>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <Icon name="close" size={24} color={t.colors.text} />
        </Pressable>
      </Row>
      <Card tier={3} style={{ gap: 6 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Heading size="lg">SubPulse Pro</Heading>
          <Badge text={isPremium ? 'Active' : 'Zero ads'} tone="accent" />
        </Row>
        <Body muted>Tired of sponsored inserts? Unlock a clean, ad-free SubPulse.</Body>
        {PERKS.map((p) => (
          <Row key={p}>
            <Icon name="check-circle-outline" size={16} color={t.colors.accent} />
            <Body small>{p}</Body>
          </Row>
        ))}
      </Card>

      {isPremium ? <Body style={{ color: t.colors.accent }}>You're on Pro. Thank you!</Body> : null}

      {!purchasesConfigured() ? (
        <Card>
          <Label color={t.colors.warning}>Store not connected yet</Label>
          <Body small muted>Purchases activate once the RevenueCat keys (EXPO_PUBLIC_REVENUECAT_*_KEY) and the store products exist — see README "Monetization". The app runs on the free, ad-supported tier until then.</Body>
        </Card>
      ) : null}

      {offering?.availablePackages.map((pkg) => (
        <Card key={pkg.identifier}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Label>{pkg.packageType === 'LIFETIME' ? 'Lifetime' : pkg.packageType.toLowerCase()}</Label>
              <Metric size={22}>{pkg.product.priceString}</Metric>
              <Body small muted>{pkg.product.title}</Body>
            </View>
            <Button title={pkg.packageType === 'LIFETIME' ? 'Buy once' : 'Subscribe'} loading={busy === pkg.identifier} disabled={isPremium} onPress={() => buy(pkg)} />
          </Row>
        </Card>
      ))}

      <Button kind="ghost" title="Restore purchases" loading={busy === 'restore'} onPress={restore} disabled={!purchasesConfigured()} />
      <Body small muted style={{ textAlign: 'center' }}>Payment is handled by Google Play / the App Store. Cancel or manage anytime in your store account.</Body>
    </Screen>
  );
}

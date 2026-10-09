import React from 'react';
import { View } from 'react-native';
import { usePreferences } from '../context/PreferencesContext';
import { bannerUnit } from '../utils/ad';
import { Body, Card, Label, Row, Button } from '../ui/kit';

/**
 * Sponsored slot for the free tier. Renders a real AdMob adaptive banner in
 * native builds; in Expo Go (no ads SDK) it shows an "upgrade to remove ads"
 * card instead, so the layout is the same everywhere. Hidden for Pro users.
 */
export default function AdBanner({ onUpgrade }: { onUpgrade?: () => void }) {
  const { isPremium } = usePreferences();
  if (isPremium) return null;

  const unit = bannerUnit();
  if (unit) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { BannerAd, BannerAdSize } = require('react-native-google-mobile-ads');
      return (
        <View style={{ alignItems: 'center', marginVertical: 4 }}>
          <Label style={{ marginBottom: 4 }}>Sponsored</Label>
          <BannerAd unitId={unit} size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER} requestOptions={{ requestNonPersonalizedAdsOnly: true }} />
        </View>
      );
    } catch {
      /* fall through to house ad */
    }
  }
  return (
    <Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <Label>Sponsored slot</Label>
          <Body small muted>Free tier is ad-supported. Go Pro for an ad-free app.</Body>
        </View>
        {onUpgrade ? <Button compact title="Remove ads" onPress={onUpgrade} /> : null}
      </Row>
    </Card>
  );
}

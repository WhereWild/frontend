// app/species/[id].tsx
import React from 'react';
import { IconDownload, IconArrowRight } from '@/assets/icons';
import {View, ScrollView, Text, Image, StyleSheet} from 'react-native';
import { usePathname, useRouter, useLocalSearchParams } from 'expo-router';
import {PageHeader, Button, IconButton } from '@/components';
import { Colors, Typography, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';

const HEAT_MAP_IMAGE = require('./Heat_Map.png');
const MAP_HEIGHT = 600;
export default function SpeciesPage() {
  const router = useRouter();
  const pathnameRaw = usePathname() ?? ''; 
  const params = useLocalSearchParams();

  const colorScheme = useColorScheme();
  const mode = colorScheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
  const id = pathnameRaw.split('/').filter(Boolean).pop() ?? 'unknown'
  const commonName = params.name?.toString() ?? "";
  const scientificName = params.sciName?.toString() ?? ""
  const disc = params.discription?.toString() ?? ""


  let imageUri = params.image ?? undefined;
  imageUri = imageUri.toString();
  if (imageUri) {
    try { imageUri = decodeURIComponent(imageUri); } catch {}
  }

  const imageSource = imageUri ? { uri: imageUri } : undefined;


  function DetailsCard({ items }: { items: { label: string; value?: string }[] }) {
    const [expandedIndex, setExpandedIndex] = React.useState<number | null>(null);

    const toggle = (i: number) => {
      setExpandedIndex((prev) => (prev === i ? null : i));
    };

    return (
      <View style={[styles.detailsCard, { backgroundColor: palette.background.default.default }]}>
        {items.map((it, i) => {
          const expanded = expandedIndex === i;
          return (
            <View key={i}>
              <View style={styles.detailRow}>
                <View style={styles.detailText}>
                  <Text style={[Typography[mode].body, styles.detailLabel]} numberOfLines={1}>
                    {it.label}
                  </Text>
                  {it.value ? (
                    <Text style={[Typography[mode].body, styles.detailValue]} numberOfLines={1}>
                      {it.value}
                    </Text>
                  ) : null}
                </View>

                <IconButton
                  variant="neutral"
                  size="small"
                  icon={<IconArrowRight />}
                  accessibilityLabel={expanded ? `Collapse ${it.label}` : `Open ${it.label}`}
                  onPress={() => toggle(i)}
                  style={styles.rowButton}
                />
              </View>

              {expanded ? (
                <View style={[styles.menu, { backgroundColor: palette.background.default.default }]}>
                  <Text style={[Typography[mode].body, styles.menuItem]} onPress={() => console.log('view', it.label)}>
                    View details
                  </Text>
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
    );
  }
  return (
    <View style={[styles.screen, { backgroundColor: palette.background.default.default }]}>
      <PageHeader
        onLogoPress={() => router.push('/')}
      />

      <ScrollView contentContainerStyle={styles.container}>
        <Button
          variant='neutral'
          size='small'
          iconStart={<IconDownload/>}
          style={styles.downloadButton}
          label='Download'
          ></Button>

        <Text style={[Typography[mode].heading, styles.title]}>{commonName}</Text>
        <Text style={[Typography[mode].body, styles.idText]}>{scientificName}</Text>
        <View
        style={{
          height: 1,
          backgroundColor: Typography[mode].heading.color,
          marginVertical: Size.space['400'],
          width: '100%',
        }}
          />

        <View style={{ flexDirection: 'row' }}>
          <Image
            source={imageSource ?? { uri: 'https://via.placeholder.com/600x400?text=No+image' }}
            style={styles.image}
            resizeMode="contain"
          />

          <DetailsCard
            items={[
              { label: 'Avg. elevation', value: '2000 m' },
              { label: 'Avg. precipitation', value: '39.4 cm' },
              { label: 'Common climate', value: 'desert' },
              { label: 'Preferred weather', value: 'N/A' },
            ]}
          />
        </View>

        <Text style={[Typography[mode].body, styles.body]}>
          {disc}
        </Text>
        <Text style={[Typography[mode].heading, styles.title]}>Species Map</Text>

        <View style={[styles.mapContainer, { height: MAP_HEIGHT }]}>
          <Image source={HEAT_MAP_IMAGE} style={[styles.mapImage, { height: MAP_HEIGHT }]} resizeMode="stretch" />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  container: {
    paddingHorizontal: Size.space['1600'],
    paddingTop: Size.space['800'],
    paddingBottom: Size.space['800'],
  },
  downloadButton: {
    position: 'absolute',
    top: 30,
    right: 24,
    zIndex: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  mapContainer: {
    width: '100%',
    position: 'relative', 
    overflow: 'hidden',
    borderRadius: 8,
    marginBottom: Size.space['600'],
  },
  mapImage: {
    width: '100%',
  },
  idText: {
    color: '#666',
    marginBottom: 12,
  },
  image: {
    width: '40%',
    height: 360,
    borderRadius: 8,
    marginBottom: 12,
  },
  body: {
    fontSize: 16,
    marginLeft: -20,
  },
  detailsCard: {
  width: '20%',
  borderRadius: 8,
  borderWidth: 1,
  borderColor: '#00000006',
  overflow: 'hidden',
  marginBottom: Size.space['400'],
},
detailRow: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingVertical: 10,
  paddingHorizontal: 12,
  borderTopWidth: 1,
  borderTopColor: '#00000004',
},
detailText: {
  flex: 1,
  paddingRight: 8,
},
detailLabel: {
  fontSize: 14,
  fontWeight: '600',
},
detailValue: {
  fontSize: 13,
  color: '#666666',
  marginTop: 2,
},
menu: {
  paddingVertical: 8,
  paddingHorizontal: 12,
  borderTopWidth: 1,
  borderTopColor: '#00000004',
},
menuItem: {
  paddingVertical: 8,
},
rowButton: {
  padding: 6,
  marginLeft: 8,
  alignSelf: 'center',
},

});
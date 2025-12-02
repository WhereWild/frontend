import React from 'react';
import { View, ScrollView, Image, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { PageHeader, Button, IconButton, ThemedText } from '@/components';
import { IconDownload, IconArrowRight } from '@/assets/icons';
import { Colors, Typography, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { fetchSpeciesBySlug } from '@/data/api';

type SpeciesBasics = {
  common_name: string;
  scientific_name: string;
  image_source?: any;
  image_url?: string; // require('...') or { uri: '...' }
  description?: string;
};

export default function SpeciesBasicsPage() {
  const router = useRouter();
  const { slug } = useLocalSearchParams<{ slug: string }>();

  const colorScheme = useColorScheme();
  const mode = colorScheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];

  const [data, setData] = React.useState<SpeciesBasics | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchSpeciesBySlug(String(slug));
        if (!mounted) return;
        setData(res ?? null);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message ?? 'Failed to load species');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [slug]);

  if(data == null)
    return;


  // Normalize image_source: allow require(...) or { uri }
  // If backend gives a raw string, convert to { uri: string }
  let imageSource: any = undefined;
  if (data.image_source) {
    if (typeof data.image_source === 'string') {
      imageSource = { uri: data.image_source };
    } else if (data?.image_url) {
        imageSource = { uri: data.image_url }; // <-- use backend-provided URL
        }
  }

  return (
    <View style={[styles.screen, { backgroundColor: palette.background.default.default }]}>
              <PageHeader/>
      <ScrollView contentContainerStyle={styles.container}>
        <Button
          variant="neutral"
          size="small"
          iconStart={<IconDownload />}
          style={styles.downloadButton}
          label="Download"
          onPress={() => console.log('download', data.common_name)}
        />

        <Text style={[Typography[mode].heading, styles.title]}>{data.common_name}</Text>
        <Text style={[Typography[mode].body, styles.idText]}>{data.scientific_name}</Text>

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
            accessibilityLabel={`${data.common_name} image`}
          />

          <DetailsCard
            palette={palette}
            mode={mode}
            items={[
              { label: 'Avg. elevation', value: '2000 m' },
              { label: 'Avg. precipitation', value: '39.4 cm' },
              { label: 'Common climate', value: 'desert' },
              { label: 'Preferred weather', value: 'N/A' },
            ]}
          />
        </View>

        {data.description ? (
          <Text style={[Typography[mode].body, styles.body]}>{data.description}</Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

function DetailsCard({
  items,
  palette,
  mode,
}: {
  items: { label: string; value?: string }[];
  palette: typeof Colors['light'];
  mode: 'light' | 'dark';
}) {
  const [expandedIndex, setExpandedIndex] = React.useState<number | null>(null);
  const toggle = (i: number) => setExpandedIndex((prev) => (prev === i ? null : i));

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
                <Text
                  style={[Typography[mode].body, styles.menuItem]}
                  onPress={() => console.log('view', it.label)}
                >
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
  idText: {
    color: '#666',
    marginBottom: 12,
  },
  image: {
    width: '40%',
    height: 360,
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: '#00000008', // helps visually if image fails
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
    marginLeft: Size.space['600'],
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
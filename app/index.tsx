import { Text, View, ScrollView, StyleSheet } from "react-native";
import { Button, ButtonDanger, IconButton } from "@/components";
import { Size, Colors, Typography } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

// Simple star icon component for demo
const StarIcon = ({ color = "#fff", size = 20 }: { color?: string; size?: number }) => (
  <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
    <Text style={{ color, fontSize: size * 0.8 }}>★</Text>
  </View>
);

export default function Index() {
  const colorScheme = useColorScheme();
  const mode = colorScheme === 'dark' ? 'dark' : 'light';

  return (
    <ScrollView contentContainerStyle={[
      styles.container,
      { backgroundColor: Colors[mode].background.default.default }
    ]}>
      <Text style={Typography[mode].bodyStrong}>Button — Primary</Text>
      <View style={styles.row}>
        <Button onPress={() => {}}>Medium</Button>
        <Button size="small" onPress={() => {}}>Small</Button>
        <Button disabled>Disabled</Button>
        <Button size="small" disabled>Disabled Small</Button>
      </View>

      <Text style={Typography[mode].bodyStrong}>Button — Neutral</Text>
      <View style={styles.row}>
        <Button variant="neutral" onPress={() => {}}>Medium</Button>
        <Button variant="neutral" size="small" onPress={() => {}}>Small</Button>
        <Button variant="neutral" disabled>Disabled</Button>
        <Button variant="neutral" size="small" disabled>Disabled Small</Button>
      </View>

      <Text style={Typography[mode].bodyStrong}>Button — Subtle</Text>
      <View style={styles.row}>
        <Button variant="subtle" onPress={() => {}}>Medium</Button>
        <Button variant="subtle" size="small" onPress={() => {}}>Small</Button>
        <Button variant="subtle" disabled>Disabled</Button>
        <Button variant="subtle" size="small" disabled>Disabled Small</Button>
      </View>

      <Text style={Typography[mode].bodyStrong}>ButtonDanger — Primary</Text>
      <View style={styles.row}>
        <ButtonDanger onPress={() => {}}>Medium</ButtonDanger>
        <ButtonDanger size="small" onPress={() => {}}>Small</ButtonDanger>
        <ButtonDanger disabled>Disabled</ButtonDanger>
        <ButtonDanger size="small" disabled>Disabled Small</ButtonDanger>
      </View>

      <Text style={Typography[mode].bodyStrong}>ButtonDanger — Subtle</Text>
      <View style={styles.row}>
        <ButtonDanger variant="subtle" onPress={() => {}}>Medium</ButtonDanger>
        <ButtonDanger variant="subtle" size="small" onPress={() => {}}>Small</ButtonDanger>
        <ButtonDanger variant="subtle" disabled>Disabled</ButtonDanger>
        <ButtonDanger variant="subtle" size="small" disabled>Disabled Small</ButtonDanger>
      </View>

      <Text style={Typography[mode].bodyStrong}>IconButton — Primary</Text>
      <View style={styles.row}>
        <IconButton 
          icon={<StarIcon color={Colors[mode].icon.brand.onBrand} />}
          accessibilityLabel="Star"
          onPress={() => {}}
        />
        <IconButton 
          icon={<StarIcon color={Colors[mode].icon.brand.onBrand} size={20} />}
          accessibilityLabel="Star"
          size="small"
          onPress={() => {}}
        />
        <IconButton 
          icon={<StarIcon color={Colors[mode].icon.disabled.onDisabled} />}
          accessibilityLabel="Star"
          disabled
        />
        <IconButton 
          icon={<StarIcon color={Colors[mode].icon.disabled.onDisabled} size={20} />}
          accessibilityLabel="Star"
          size="small"
          disabled
        />
      </View>

      <Text style={Typography[mode].bodyStrong}>IconButton — Neutral</Text>
      <View style={styles.row}>
        <IconButton 
          variant="neutral"
          icon={<StarIcon color={Colors[mode].icon.neutral.onNeutralSecondary} />}
          accessibilityLabel="Star"
          onPress={() => {}}
        />
        <IconButton 
          variant="neutral"
          icon={<StarIcon color={Colors[mode].icon.neutral.onNeutralSecondary} size={20} />}
          accessibilityLabel="Star"
          size="small"
          onPress={() => {}}
        />
        <IconButton 
          variant="neutral"
          icon={<StarIcon color={Colors[mode].icon.disabled.onDisabled} />}
          accessibilityLabel="Star"
          disabled
        />
        <IconButton 
          variant="neutral"
          icon={<StarIcon color={Colors[mode].icon.disabled.onDisabled} size={20} />}
          accessibilityLabel="Star"
          size="small"
          disabled
        />
      </View>

      <Text style={Typography[mode].bodyStrong}>IconButton — Subtle</Text>
      <View style={styles.row}>
        <IconButton 
          variant="subtle"
          icon={<StarIcon color={Colors[mode].icon.neutral.default} />}
          accessibilityLabel="Star"
          onPress={() => {}}
        />
        <IconButton 
          variant="subtle"
          icon={<StarIcon color={Colors[mode].icon.neutral.default} size={20} />}
          accessibilityLabel="Star"
          size="small"
          onPress={() => {}}
        />
        <IconButton 
          variant="subtle"
          icon={<StarIcon color={Colors[mode].icon.disabled.onDisabled} />}
          accessibilityLabel="Star"
          disabled
        />
        <IconButton 
          variant="subtle"
          icon={<StarIcon color={Colors[mode].icon.disabled.onDisabled} size={20} />}
          accessibilityLabel="Star"
          size="small"
          disabled
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Size.space[600],
    gap: Size.space[600],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: Size.space[300],
  },
});

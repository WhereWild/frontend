import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { Colors, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Button } from '@/components/buttons/Button';
import { ButtonDanger } from '@/components/buttons/ButtonDanger';
import { RadioGroup } from '@/components/inputs/RadioGroup';
import { SwitchField } from '@/components/inputs/SwitchField';
import { ThemedText } from '@/components/text/ThemedText';
import type { ReinforcementState } from '@/hooks/species/useReinforcement';

export type ReinforcementSectionProps = {
  reinforcement: ReinforcementState;
};

const FEEDBACK_MODE_OPTIONS = [
  { label: 'Present', value: 'present', description: 'Mark species as present at tapped location' },
  { label: 'Absent', value: 'absent', description: 'Mark species as absent at tapped location' },
];

export function ReinforcementSection({ reinforcement }: ReinforcementSectionProps) {
  const mode = useColorScheme() === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];

  const {
    enabled,
    setEnabled,
    markPresent,
    setMarkPresent,
    feedbackLog,
    hasReinforcedHead,
    isReinforcedHeadStatusLoading,
    lastResult,
    resetHead,
    save,
    load,
    busy,
    error,
    statusMessage,
  } = reinforcement;

  const handleModeChange = useCallback(
    (value: string) => setMarkPresent(value === 'present'),
    [setMarkPresent],
  );

  const handleSave = useCallback(() => save(), [save]);
  const handleLoad = useCallback(() => load(), [load]);

  const feedbackModeValue = markPresent ? 'present' : 'absent';

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: palette.background.default.secondary },
      ]}
    >
      <SwitchField
        label="Reinforcement Learning"
        description="Tap the map to submit feedback and refine predictions"
        value={enabled}
        onValueChange={setEnabled}
        accessibilityLabel="Reinforcement Learning"
      />

      {enabled && (
        <View style={styles.controls}>
          <RadioGroup
            label="Feedback Mode"
            options={FEEDBACK_MODE_OPTIONS}
            value={feedbackModeValue}
            onValueChange={handleModeChange}
            disabled={busy}
          />

          <View style={styles.statsRow}>
            <ThemedText variant="bodySmall">
              Feedback points: {feedbackLog.length}
            </ThemedText>
            <ThemedText variant="bodySmall">
              Reinforced head: {isReinforcedHeadStatusLoading ? 'Checking...' : hasReinforcedHead ? 'Available' : 'Unavailable'}
            </ThemedText>
            {lastResult && (
              <ThemedText variant="bodySmall">
                Last score: {lastResult.originalScore.toFixed(3)} → {lastResult.reinforcedScore.toFixed(3)}
              </ThemedText>
            )}
          </View>

          <View style={styles.actions}>
            <Button
              variant="neutral"
              size="small"
              onPress={handleSave}
              disabled={busy || feedbackLog.length === 0}
            >
              Save Head
            </Button>
            <Button
              variant="neutral"
              size="small"
              onPress={handleLoad}
              disabled={busy || isReinforcedHeadStatusLoading || !hasReinforcedHead}
            >
              Load Head
            </Button>
            <ButtonDanger
              variant="subtle"
              size="small"
              onPress={resetHead}
              disabled={busy || feedbackLog.length === 0}
            >
              Reset
            </ButtonDanger>
          </View>

          {error && (
            <ThemedText variant="bodySmall" style={{ color: palette.text.danger.default }}>
              {error}
            </ThemedText>
          )}

          {statusMessage && (
            <ThemedText variant="bodySmall">{statusMessage}</ThemedText>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: Size.radius['200'],
    padding: Size.space['400'],
    gap: Size.space['400'],
  },
  controls: {
    gap: Size.space['400'],
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Size.space['300'],
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Size.space['200'],
  },
});

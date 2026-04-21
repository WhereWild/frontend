import {
  ButtonDanger,
  RadioGroup,
  SwitchField,
  ThemedText,
} from '@/components';
import { Colors, Size } from '@/constants/theme';
import type { ReinforcementDemoState } from '@/hooks/species/useReinforcementDemo';
import { useColorScheme } from '@/hooks/useColorScheme';
import React from 'react';
import { StyleSheet, View } from 'react-native';

export type ReinforcementDemoSectionProps = {
  reinforcement: ReinforcementDemoState;
  disabled?: boolean;
};

const FEEDBACK_MODE_OPTIONS = [
  {
    label: 'Present',
    value: 'present',
    description: 'Increase suitability at the selected location.',
  },
  {
    label: 'Absent',
    value: 'absent',
    description: 'Decrease suitability at the selected location.',
  },
];

export function ReinforcementDemoSection({
  reinforcement,
  disabled = false,
}: ReinforcementDemoSectionProps) {
  const mode = useColorScheme() === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
  const feedbackMode = reinforcement.markPresent ? 'present' : 'absent';
  const remainingFeedbackCount =
    reinforcement.activationThreshold - reinforcement.feedbackCount;
  const progressLabel = reinforcement.isActive
    ? 'Personalized tiles active.'
    : remainingFeedbackCount <= 0
      ? 'Activation threshold reached. Personalized tiles will activate once the private head update is ready.'
      : `Need ${remainingFeedbackCount} more feedback point(s) to activate personalized tiles.`;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: palette.background.default.secondary },
      ]}
    >
      <SwitchField
        label='Personalized head fine-tuning'
        description={
          disabled
            ? 'Requires the inference heatmap for this species.'
            : 'Open a map point and use its popup button to submit a private present or absent correction for this species. The shared model stays unchanged, and the personalized head is used only after it reaches the activation threshold.'
        }
        value={reinforcement.enabled}
        disabled={disabled}
        onValueChange={reinforcement.setEnabled}
      />

      {reinforcement.enabled ? (
        <View style={styles.controls}>
          <RadioGroup
            label='Feedback mode'
            options={FEEDBACK_MODE_OPTIONS}
            value={feedbackMode}
            disabled={reinforcement.busy}
            onValueChange={(nextValue) =>
              reinforcement.setMarkPresent(nextValue === 'present')
            }
          />
          <View style={styles.metaRow}>
            <ThemedText variant='bodySmall'>
              Feedback points: {reinforcement.feedbackCount}
            </ThemedText>
            <ThemedText variant='bodySmall'>
              Head:{' '}
              {reinforcement.hasReinforcedHead
                ? 'private clone ready'
                : 'not started'}
            </ThemedText>
          </View>
          <ThemedText variant='bodySmall'>{progressLabel}</ThemedText>
          {reinforcement.lastResult ? (
            <ThemedText variant='bodySmall'>
              Last point score:{' '}
              {reinforcement.lastResult.originalScore.toFixed(3)}
              {' → '}
              {reinforcement.lastResult.reinforcedScore.toFixed(3)}
            </ThemedText>
          ) : null}
          {reinforcement.error ? (
            <ThemedText
              variant='bodySmall'
              style={{ color: palette.text.danger.default }}
            >
              {reinforcement.error}
            </ThemedText>
          ) : null}
          <ButtonDanger
            variant='subtle'
            size='small'
            disabled={reinforcement.busy || !reinforcement.hasReinforcedHead}
            onPress={() => {
              void reinforcement.resetHead();
            }}
          >
            Reset Personalized Head
          </ButtonDanger>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: Size.radius['200'],
    padding: Size.space['400'],
    gap: Size.space['300'],
  },
  controls: {
    gap: Size.space['300'],
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Size.space['300'],
  },
});

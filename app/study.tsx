// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

// Visualization-study page (class project experiment). For each species in
// STUDY_SPECIES, shows only that species' occurrence map colored by annual
// mean temperature (bio1), asks the (TBD) questions, posts the answers to the
// backend, then moves on to the next species.
//
// Conditions (the study's independent variables) are fixed for now:
//   - catalog colormap override ON (bio1's coolwarm)
//   - global bounds ON (the variable's catalog renderMin/renderMax rather than
//     the species' observed range)
//   - custom colormap_bounds (-10..80 F) OFF
// The map shows plain basemap tiles (no variable heatmap) under the dots.
// Assigning/rotating conditions per participant is not built yet.

import { Button, PageScrollContainer } from '@/components';
import { PageSurface } from '@/components/PageSurface';
import { ThemedText } from '@/components/text/ThemedText';
import { StudyMap } from '@/components/sections/StudyMap';
import { fetchEnvironmentVariables } from '@/data/api';
import { BACKEND_BASE } from '@/data/apiShared';
import type { EnvironmentVariableDefinition } from '@/data/types';
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import React from 'react';

type StudySpecies = { taxonId: string; label: string };

// Placeholder lists — to be set by the study author. Each trial is the
// species shown at once: one in the default mode, a pair side by side in
// juxtapose mode (/study?mode=juxtapose).
const SINGLE_TRIALS: StudySpecies[][] = [
  [{ taxonId: '6SRLS', label: 'Opuntia fragilis' }],
  [{ taxonId: '74RNL', label: 'Opuntia polyacantha' }],
];
const JUXTAPOSE_TRIALS: StudySpecies[][] = [
  [
    { taxonId: '6SRLS', label: 'Opuntia fragilis' },
    { taxonId: '3ZLRB', label: 'Melocactus macracanthos' },
  ],
];

const VARIABLE_ID = 'bio1';
const UNITS = 'imperial';
const MAP_HEIGHT = 480;

const newParticipantId = () =>
  `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export default function StudyPage() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const juxtapose = mode === 'juxtapose';
  const trials = juxtapose ? JUXTAPOSE_TRIALS : SINGLE_TRIALS;

  const participantId = React.useRef(newParticipantId()).current;
  const [index, setIndex] = React.useState(0);
  const [variable, setVariable] =
    React.useState<EnvironmentVariableDefinition | null>(null);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const shownAtRef = React.useRef(Date.now());

  const trial = index < trials.length ? trials[index] : null;

  React.useEffect(() => {
    let cancelled = false;
    fetchEnvironmentVariables({ units: UNITS })
      .then((vars) => {
        if (!cancelled) {
          setVariable(vars.find((v) => v.id === VARIABLE_ID) ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) setVariable(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Reset the per-trial timer whenever a new trial is shown.
  React.useEffect(() => {
    shownAtRef.current = Date.now();
    setSubmitError(null);
  }, [index]);

  const submit = async () => {
    if (!trial) return;
    setSubmitError(null);
    try {
      const response = await fetch(`${BACKEND_BASE}/study/responses`, {
        method: 'POST',
        // text/plain keeps this a CORS "simple request" (see backend).
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          participantId,
          mode: juxtapose ? 'juxtapose' : 'single',
          trialIndex: index,
          species: trial.map((s) => ({
            taxonId: s.taxonId,
            scientificName: s.label,
          })),
          variable: VARIABLE_ID,
          conditions: { colormapOverride: true, globalBounds: true },
          // TBD: the study's questions/answers go here.
          answers: {},
          elapsedMs: Date.now() - shownAtRef.current,
        }),
      });
      if (!response.ok) throw new Error(`Server responded ${response.status}`);
      setIndex((i) => i + 1);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to submit');
    }
  };

  return (
    <PageSurface hideFooter>
      <PageScrollContainer>
        <View style={styles.container}>
          {!trial ? (
            <ThemedText>Thank you — that was the last one.</ThemedText>
          ) : (
            <>
              <ThemedText>{`${index + 1} of ${trials.length}`}</ThemedText>
              {variable ? (
                <View style={styles.maps}>
                  {trial.map((s) => (
                    <StudyMap
                      key={s.taxonId}
                      taxonId={s.taxonId}
                      variable={variable}
                      units={UNITS}
                      height={MAP_HEIGHT}
                    />
                  ))}
                </View>
              ) : (
                <ThemedText>Loading…</ThemedText>
              )}
              <View style={styles.questions}>
                <ThemedText>Questions to be determined.</ThemedText>
                {submitError && <ThemedText>{submitError}</ThemedText>}
                <Button variant='primary' label='Next' onPress={submit} />
              </View>
            </>
          )}
        </View>
      </PageScrollContainer>
    </PageSurface>
  );
}

const styles = StyleSheet.create({
  container: { gap: 16, padding: 16 },
  maps: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  questions: { gap: 12 },
});

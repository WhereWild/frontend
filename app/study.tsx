// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

// Visualization-study page (class project experiment). Each trial shows one
// species' occurrence map (or, in juxtapose mode, two side by side) colored by
// annual mean temperature (bio1). A trial with a `question` asks "where is
// this species' habitat the hottest/coldest?" — the participant clicks a dot
// (which opens the existing popup and highlights it), then presses Next, which
// posts the decision, its distance from the true extreme, and timing to the
// backend.
//
// Conditions (the study's independent variables) are fixed for now:
//   - catalog colormap override ON (bio1's coolwarm)
//   - global bounds ON (the variable's catalog renderMin/renderMax rather than
//     the species' observed range)
//   - observed luminance/saturation ON (hue still from the global range; see
//     studyColors.ts)
//   - custom colormap_bounds (-10..80 F) OFF
// The map shows plain basemap tiles (no variable heatmap) under the dots.
// Assigning/rotating conditions per participant is not built yet.

import { Button, PageScrollContainer } from '@/components';
import { PageSurface } from '@/components/PageSurface';
import { ThemedText } from '@/components/text/ThemedText';
import { StudyMap } from '@/components/sections/StudyMap';
import type {
  ExtremeTarget,
  StudySelection,
} from '@/components/sections/studyScoring';
import { fetchEnvironmentVariables } from '@/data/api';
import { BACKEND_BASE } from '@/data/apiShared';
import type { EnvironmentVariableDefinition } from '@/data/types';
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import React from 'react';

type StudySpecies = { taxonId: string; label: string };
type StudyTrial = {
  species: StudySpecies[];
  /** When set, the participant must click the species' hottest/coldest dot. */
  question?: { target: ExtremeTarget };
};

// Placeholder lists — to be set by the study author. Default mode: one species
// per trial with the hottest/coldest question. Juxtapose mode
// (/study?mode=juxtapose): a pair side by side; no question yet.
const SINGLE_TRIALS: StudyTrial[] = [
  {
    species: [{ taxonId: '6SRLS', label: 'Opuntia fragilis' }],
    question: { target: 'hottest' },
  },
  {
    species: [{ taxonId: '3ZLRB', label: 'Melocactus macracanthos' }],
    question: { target: 'hottest' },
  },
  {
    species: [{ taxonId: '74RNL', label: 'Opuntia polyacantha' }],
    question: { target: 'coldest' },
  },
];
const JUXTAPOSE_TRIALS: StudyTrial[] = [
  {
    species: [
      { taxonId: '6SRLS', label: 'Opuntia fragilis' },
      { taxonId: '3ZLRB', label: 'Melocactus macracanthos' },
    ],
  },
];

const VARIABLE_ID = 'bio1';
const CONDITIONS = {
  colormapOverride: true,
  globalBounds: true,
  observedLumSat: true,
};
const UNITS = 'imperial';
const MAP_HEIGHT = 480;

const newParticipantId = () =>
  `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const formatSelection = (sel: StudySelection, units: string) =>
  sel.selected.value != null
    ? `Selected observation ${sel.selected.catalogNumber} (${sel.selected.value.toFixed(1)} ${units}).`
    : `Selected observation ${sel.selected.catalogNumber}.`;

export default function StudyPage() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const juxtapose = mode === 'juxtapose';
  const trials = juxtapose ? JUXTAPOSE_TRIALS : SINGLE_TRIALS;

  const participantId = React.useRef(newParticipantId()).current;
  const [index, setIndex] = React.useState(0);
  const [variable, setVariable] =
    React.useState<EnvironmentVariableDefinition | null>(null);
  const [selection, setSelection] = React.useState<StudySelection | null>(null);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  // Timing starts only once every map in the trial is loaded and usable, so
  // load time never counts against the participant.
  const readyMapsRef = React.useRef(new Set<string>());
  const startedAtRef = React.useRef<number | null>(null);
  const clicksRef = React.useRef<{ tMs: number; catalogNumber: string }[]>([]);

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

  const markReady = React.useCallback(
    (taxonId: string) => {
      if (!trial || startedAtRef.current != null) return;
      readyMapsRef.current.add(taxonId);
      if (readyMapsRef.current.size >= trial.species.length) {
        startedAtRef.current = Date.now();
      }
    },
    [trial],
  );

  const handleSelect = React.useCallback((next: StudySelection) => {
    // A click before the timer starts (maps not both ready) can't be timed.
    const startedAt = startedAtRef.current;
    clicksRef.current.push({
      tMs: startedAt != null ? Date.now() - startedAt : -1,
      catalogNumber: next.selected.catalogNumber,
    });
    setSelection(next);
  }, []);

  const needsAnswer = Boolean(trial?.question);
  const canSubmit = !needsAnswer || selection != null;

  const submit = async () => {
    if (!trial) return;
    setSubmitError(null);
    const startedAt = startedAtRef.current;
    const clicks = clicksRef.current;
    try {
      const response = await fetch(`${BACKEND_BASE}/study/responses`, {
        method: 'POST',
        // text/plain keeps this a CORS "simple request" (see backend).
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          participantId,
          mode: juxtapose ? 'juxtapose' : 'single',
          trialIndex: index,
          species: trial.species.map((s) => ({
            taxonId: s.taxonId,
            scientificName: s.label,
          })),
          variable: VARIABLE_ID,
          units: UNITS,
          conditions: CONDITIONS,
          question: trial.question
            ? { id: 'habitat-extreme', target: trial.question.target }
            : null,
          answer: selection
            ? {
                selected: selection.selected,
                truth: selection.truth,
                valueDiff: selection.valueDiff,
                distanceKm: selection.distanceKm,
              }
            : null,
          timing: {
            startedAt,
            timeToFirstClickMs: clicks[0]?.tMs ?? null,
            timeToFinalClickMs: clicks[clicks.length - 1]?.tMs ?? null,
            elapsedMs: startedAt != null ? Date.now() - startedAt : null,
          },
          clicks,
        }),
      });
      if (!response.ok) throw new Error(`Server responded ${response.status}`);
      readyMapsRef.current.clear();
      startedAtRef.current = null;
      clicksRef.current = [];
      setSelection(null);
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
              {trial.question && (
                <ThemedText>
                  {`Where is this species' habitat the ${trial.question.target}? Click that dot on the map.`}
                </ThemedText>
              )}
              {variable ? (
                <View style={styles.maps}>
                  {trial.species.map((s) => (
                    <StudyMap
                      key={`${index}-${s.taxonId}`}
                      taxonId={s.taxonId}
                      variable={variable}
                      units={UNITS}
                      observedLumSat={CONDITIONS.observedLumSat}
                      height={MAP_HEIGHT}
                      target={trial.question?.target}
                      onSelect={handleSelect}
                      onReady={() => markReady(s.taxonId)}
                    />
                  ))}
                </View>
              ) : (
                <ThemedText>Loading…</ThemedText>
              )}
              <View style={styles.questions}>
                {trial.question ? (
                  <ThemedText>
                    {selection
                      ? `${formatSelection(selection, variable?.units ?? '')} Click another dot to change it, or press Next.`
                      : 'No dot selected yet.'}
                  </ThemedText>
                ) : (
                  <ThemedText>Questions to be determined.</ThemedText>
                )}
                {submitError && <ThemedText>{submitError}</ThemedText>}
                <Button
                  variant='primary'
                  label='Next'
                  disabled={!canSubmit}
                  onPress={submit}
                />
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

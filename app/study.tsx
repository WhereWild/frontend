// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

// Visualization-study page (class project experiment): occurrence maps colored
// by annual mean temperature (bio1), one question per trial, answers posted to
// the backend with timing.
//
// Default mode (/study): single-species trials, "where is this species'
// habitat the hottest/coldest?" - click a dot, then Next (studyDesign.ts).
// Comparison mode (/study?mode=juxtapose): two species side by side, "which
// species' observations have the higher average annual mean temperature?" -
// answer with a key, F for Map A or J for Map B, which submits at once and
// moves on, for speed (studyCompare.ts). Both: 40 randomized trials seeded
// by the participant id, the colormap (viridis/coolwarm) x bounds
// (observed/global) conditions balanced, observations outside each species'
// map window neither shown nor scored (studyPool.ts), plain basemap tiles.

import { Button, PageScrollContainer } from '@/components';
import { PageSurface } from '@/components/PageSurface';
import { ThemedText } from '@/components/text/ThemedText';
import { StudyMap } from '@/components/sections/StudyMap';
import type { StudySelection } from '@/components/sections/studyScoring';
import {
  comparisonTrials,
  singleSpeciesTrials,
  type StudyTrial,
} from '@/components/sections/studyTrials';
import { setMapDebug } from '@/components/sections/mapDebug';
import { fetchEnvironmentVariables } from '@/data/api';
import { BACKEND_BASE } from '@/data/apiShared';
import type { EnvironmentVariableDefinition } from '@/data/types';
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import React from 'react';

const VARIABLE_ID = 'bio1';
const UNITS = 'imperial';
const MAP_HEIGHT = 480;
const MAP_LABELS = ['Map A', 'Map B'];

const newParticipantId = () =>
  `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const formatSelection = (sel: StudySelection, units: string) =>
  sel.selected.value != null
    ? `Selected observation ${sel.selected.catalogNumber} (${sel.selected.value.toFixed(1)} ${units}).`
    : `Selected observation ${sel.selected.catalogNumber}.`;

type Click = { tMs: number; catalogNumber: string; deselected?: boolean };
type Choice = { tMs: number; choice: 0 | 1 };

export default function StudyPage() {
  // Console logging for map debugging (see mapDebug.ts) while this page is up.
  React.useEffect(() => {
    setMapDebug(true);
    return () => setMapDebug(false);
  }, []);
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const juxtapose = mode === 'juxtapose';
  const participantId = React.useRef(newParticipantId()).current;
  const trials = React.useMemo<StudyTrial[]>(
    () =>
      juxtapose
        ? comparisonTrials(participantId)
        : singleSpeciesTrials(participantId),
    [juxtapose, participantId],
  );
  const [index, setIndex] = React.useState(0);
  const [variable, setVariable] =
    React.useState<EnvironmentVariableDefinition | null>(null);
  const [selection, setSelection] = React.useState<StudySelection | null>(null);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  // Timing starts only once every map in the trial is loaded and usable, so
  // load time never counts against the participant.
  const readyMapsRef = React.useRef(new Set<string>());
  // Maps whose wait for "drawn and verified" timed out; logged per response so
  // such trials can be excluded in analysis.
  const unverifiedMapsRef = React.useRef(new Set<string>());
  const startedAtRef = React.useRef<number | null>(null);
  const clicksRef = React.useRef<Click[]>([]);
  const choicesRef = React.useRef<Choice[]>([]);

  const trial = index < trials.length ? trials[index] : null;
  // Load the next couple of trials' data while this one is in progress.
  const upcomingTaxonIds = React.useMemo(
    () =>
      trials
        .slice(index + 1, index + 3)
        .flatMap((t) => t.species.map((s) => s.taxonId)),
    [trials, index],
  );

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
    (taxonId: string, verified: boolean) => {
      if (!trial || startedAtRef.current != null) return;
      readyMapsRef.current.add(taxonId);
      if (!verified) unverifiedMapsRef.current.add(taxonId);
      if (readyMapsRef.current.size >= trial.species.length) {
        startedAtRef.current = Date.now();
      }
    },
    [trial],
  );

  const elapsedSinceStart = () =>
    startedAtRef.current != null ? Date.now() - startedAtRef.current : -1;

  const handleSelect = React.useCallback((next: StudySelection | null) => {
    // A click before the timer starts (maps not all ready) can't be timed.
    const tMs = elapsedSinceStart();
    if (next == null) {
      // Clearing removes the current selection, i.e. the last clicked dot.
      const last = clicksRef.current[clicksRef.current.length - 1];
      if (last) {
        clicksRef.current.push({
          tMs,
          catalogNumber: last.catalogNumber,
          deselected: true,
        });
      }
      setSelection(null);
      return;
    }
    clicksRef.current.push({
      tMs,
      catalogNumber: next.selected.catalogNumber,
    });
    setSelection(next);
  }, []);

  const question = trial?.question ?? null;
  const canSubmit = selection != null;

  const buildAnswer = (picked?: 0 | 1) => {
    if (!question) return null;
    if (question.kind === 'compare') {
      if (picked == null) return null;
      const [a, b] = question.meansF;
      return {
        choice: picked,
        hotterIndex: question.hotterIndex,
        correct: picked === question.hotterIndex,
        meansF: question.meansF,
        cellMeansF: question.cellMeansF,
        diffF: Math.abs(a - b),
      };
    }
    return selection
      ? {
          selected: selection.selected,
          truth: selection.truth,
          valueDiff: selection.valueDiff,
          distanceKm: selection.distanceKm,
        }
      : null;
  };

  const submittingRef = React.useRef(false);
  const submit = async (picked?: 0 | 1) => {
    if (!trial || !question || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitError(null);
    const startedAt = startedAtRef.current;
    // Selections/choices only; deselects stay logged but aren't answers.
    const answers: { tMs: number }[] =
      question.kind === 'compare'
        ? choicesRef.current
        : clicksRef.current.filter((c) => !c.deselected);
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
          conditions: trial.scheme,
          design: trial.design,
          question:
            question.kind === 'compare'
              ? { id: 'which-hotter-on-average' }
              : { id: 'habitat-extreme', target: question.target },
          answer: buildAnswer(picked),
          timing: {
            startedAt,
            mapsVerified: unverifiedMapsRef.current.size === 0,
            timeToFirstClickMs: answers[0]?.tMs ?? null,
            timeToFinalClickMs: answers[answers.length - 1]?.tMs ?? null,
            elapsedMs: startedAt != null ? Date.now() - startedAt : null,
          },
          clicks: clicksRef.current,
          choices: choicesRef.current,
        }),
      });
      if (!response.ok) throw new Error(`Server responded ${response.status}`);
      readyMapsRef.current.clear();
      unverifiedMapsRef.current.clear();
      startedAtRef.current = null;
      clicksRef.current = [];
      choicesRef.current = [];
      setSelection(null);
      setIndex((i) => i + 1);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to submit');
    } finally {
      submittingRef.current = false;
    }
  };

  // Comparison answer: F = Map A, J = Map B. Submits straight away. Ignored
  // until both maps are ready (the timer is running) and while a submit is in
  // flight, so an early or repeated press can't log a bogus time or answer.
  const handleKey = (key: string) => {
    if (question?.kind !== 'compare') return;
    const lower = key.toLowerCase();
    const picked = lower === 'f' ? 0 : lower === 'j' ? 1 : null;
    if (picked == null) return;
    if (startedAtRef.current == null || submittingRef.current) return;
    choicesRef.current.push({ tMs: elapsedSinceStart(), choice: picked });
    void submit(picked);
  };
  const handleKeyRef = React.useRef(handleKey);
  handleKeyRef.current = handleKey;
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey)
        return;
      handleKeyRef.current(event.key);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <PageSurface hideFooter>
      <PageScrollContainer>
        <View style={styles.container}>
          {!trial || !question ? (
            <ThemedText>Thank you — that was the last one.</ThemedText>
          ) : (
            <>
              <ThemedText>{`${index + 1} of ${trials.length}`}</ThemedText>
              <ThemedText>
                {question.kind === 'compare'
                  ? "Which species' observations have the higher average annual mean temperature? Press F for Map A or J for Map B."
                  : `Where is this species' habitat the ${question.target}? Click that dot on the map.`}
              </ThemedText>
              {variable ? (
                <View style={styles.maps}>
                  {trial.species.map((s, slot) => (
                    <View key={slot} style={styles.slot}>
                      {question.kind === 'compare' ? (
                        <ThemedText>{MAP_LABELS[slot]}</ThemedText>
                      ) : null}
                      <StudyMap
                        // Keyed by slot, not species: the same map instance serves
                        // every trial, so it isn't rebuilt (WebGL/tiles reloaded).
                        taxonId={s.taxonId}
                        variable={variable}
                        units={UNITS}
                        scheme={trial.scheme}
                        legendRange='observed'
                        viewBox={s.viewBox}
                        prefetchTaxonIds={upcomingTaxonIds}
                        height={MAP_HEIGHT}
                        target={
                          question.kind === 'extreme'
                            ? question.target
                            : undefined
                        }
                        onSelect={handleSelect}
                        onReady={(verified) => markReady(s.taxonId, verified)}
                        onKey={handleKey}
                      />
                    </View>
                  ))}
                </View>
              ) : (
                <ThemedText>Loading…</ThemedText>
              )}
              <View style={styles.questions}>
                {question.kind === 'compare' ? (
                  <ThemedText>
                    F = Map A is hotter, J = Map B is hotter
                  </ThemedText>
                ) : (
                  <>
                    <ThemedText>
                      {selection
                        ? `${formatSelection(selection, variable?.units ?? '')} Click another dot to change it, or press Next.`
                        : 'No dot selected yet.'}
                    </ThemedText>
                    {submitError && <ThemedText>{submitError}</ThemedText>}
                    <Button
                      variant='primary'
                      label='Next'
                      disabled={!canSubmit}
                      onPress={() => void submit()}
                    />
                  </>
                )}
                {question.kind === 'compare' && submitError ? (
                  <ThemedText>{submitError}</ThemedText>
                ) : null}
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
  slot: { flex: 1, minWidth: 280, gap: 8 },
  questions: { gap: 12 },
});

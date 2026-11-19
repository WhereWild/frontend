// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

// Visualization-study page (class project experiment): occurrence maps colored
// by an environmental variable, one question per trial, answers posted to the
// backend with timing.
//
// A session is stages, one variable each (temperature, precipitation, sunlight,
// snow, and a control with no color metaphor), in random order and never
// interleaved. Each stage has three blocks, in random order: single-species
// ("find the highest/lowest observation": click a dot, then Next) and
// comparison ("which species has the higher average?": F for Map A, J for Map
// B, which submits at once), and impression ("can this species tolerate <hot/wet/sunny/...>?": F = Yes,
// J = No, scored against the species' own extreme; no popups). Every block opens with a short intro. Trials are
// randomized and balanced over neutral/thematic colormap x observed/global
// bounds, seeded by the participant id (studySession.ts). Observations outside
// each species' map window are neither shown nor scored (studyStageData.ts).
//
// Optional URL params for piloting: ?variables=bio1,bio12 and ?tasks=single or
// ?tasks=compare or ?tasks=impression restrict the session.

import { Button, PageScrollContainer } from '@/components';
import { PageSurface } from '@/components/PageSurface';
import { ThemedText } from '@/components/text/ThemedText';
import { StudyMap } from '@/components/sections/StudyMap';
import type { StudySelection } from '@/components/sections/studyScoring';
import { buildSession } from '@/components/sections/studySession';
import { introText, questionText } from '@/components/sections/studyText';
import type { StudyTask } from '@/components/sections/studyTrials';
import {
  getStudyVariable,
  STUDY_VARIABLES,
  type StudyVariableId,
} from '@/components/sections/studyVariables';
import { setMapDebug } from '@/components/sections/mapDebug';
import { fetchEnvironmentVariables } from '@/data/api';
import { BACKEND_BASE } from '@/data/apiShared';
import type { EnvironmentVariableDefinition } from '@/data/types';
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import React from 'react';

const UNITS = 'imperial';
const MIN_MAP_HEIGHT = 480;
// Space the stage line, question, and answer controls take around the maps.
const PAGE_CHROME_HEIGHT = 300;
const MAP_LABELS = ['Map A', 'Map B'];

const newParticipantId = () =>
  `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const isVariableId = (value: string): value is StudyVariableId =>
  STUDY_VARIABLES.some((v) => v.id === value);

const formatSelection = (sel: StudySelection, units: string) =>
  sel.selected.value != null
    ? `Selected observation ${sel.selected.catalogNumber} (${sel.selected.value.toFixed(1)}${units ? ` ${units}` : ''}).`
    : `Selected observation ${sel.selected.catalogNumber}.`;

type Click = { tMs: number; catalogNumber: string; deselected?: boolean };
/** A keyed/clicked answer: Map A/B (0/1) for comparisons, or Yes/No (1/0) for
 * impressions. */
type Choice = { tMs: number; choice: number };

export default function StudyPage() {
  // Console logging for map debugging (see mapDebug.ts) while this page is up.
  React.useEffect(() => {
    setMapDebug(true);
    return () => setMapDebug(false);
  }, []);
  const { height: windowHeight } = useWindowDimensions();
  const mapHeight = Math.max(MIN_MAP_HEIGHT, windowHeight - PAGE_CHROME_HEIGHT);
  const params = useLocalSearchParams<{
    variables?: string;
    tasks?: string;
    mode?: string;
  }>();
  const participantId = React.useRef(newParticipantId()).current;
  const trials = React.useMemo(() => {
    const variables = params.variables
      ?.split(',')
      .map((v) => v.trim())
      .filter(isVariableId);
    const tasks: StudyTask[] | undefined =
      params.tasks === 'single' || params.mode === 'single'
        ? ['single']
        : params.tasks === 'compare' || params.mode === 'juxtapose'
          ? ['compare']
          : params.tasks === 'impression'
            ? ['impression']
            : undefined;
    return buildSession(participantId, {
      variables: variables?.length ? variables : undefined,
      tasks,
    });
  }, [participantId, params.variables, params.tasks, params.mode]);

  const [index, setIndex] = React.useState(0);
  const [variableDefs, setVariableDefs] = React.useState<
    EnvironmentVariableDefinition[] | null
  >(null);
  const [selection, setSelection] = React.useState<StudySelection | null>(null);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [acknowledgedBlock, setAcknowledgedBlock] = React.useState(-1);

  // Timing starts only once every map in the trial is loaded and usable AND the
  // block intro has been dismissed, so neither load time nor reading time ever
  // counts against the participant.
  const readyMapsRef = React.useRef(new Set<string>());
  const allReadyRef = React.useRef(false);
  const startedAtRef = React.useRef<number | null>(null);
  // Maps whose wait for "drawn and verified" timed out; logged per response so
  // such trials can be excluded in analysis.
  const unverifiedMapsRef = React.useRef(new Set<string>());
  const clicksRef = React.useRef<Click[]>([]);
  const choicesRef = React.useRef<Choice[]>([]);
  const submittingRef = React.useRef(false);

  const trial = index < trials.length ? trials[index] : null;
  const variableDef =
    trial && variableDefs
      ? (variableDefs.find((v) => v.id === trial.variableId) ?? null)
      : null;
  const question = trial?.question ?? null;
  const introOpen =
    trial != null &&
    trial.indexInBlock === 0 &&
    acknowledgedBlock !== trial.blockIndex;
  const introOpenRef = React.useRef(introOpen);
  introOpenRef.current = introOpen;

  // Load the next couple of trials' data while this one is in progress.
  const upcoming = React.useMemo(
    () =>
      trials.slice(index + 1, index + 3).flatMap((t) =>
        t.species.map((s) => ({
          taxonId: s.taxonId,
          variableId: t.variableId as string,
        })),
      ),
    [trials, index],
  );

  React.useEffect(() => {
    let cancelled = false;
    fetchEnvironmentVariables({ units: UNITS })
      .then((vars) => {
        if (!cancelled) setVariableDefs(vars);
      })
      .catch(() => {
        if (!cancelled) setVariableDefs(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const tryStartTimer = () => {
    if (
      startedAtRef.current != null ||
      introOpenRef.current ||
      !allReadyRef.current
    ) {
      return;
    }
    startedAtRef.current = Date.now();
  };

  const markReady = (taxonId: string, verified: boolean) => {
    if (!trial || startedAtRef.current != null) return;
    readyMapsRef.current.add(taxonId);
    if (!verified) unverifiedMapsRef.current.add(taxonId);
    if (readyMapsRef.current.size >= trial.species.length) {
      allReadyRef.current = true;
      tryStartTimer();
    }
  };

  const dismissIntro = () => {
    if (!trial) return;
    introOpenRef.current = false;
    setAcknowledgedBlock(trial.blockIndex);
    tryStartTimer();
  };

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

  const buildAnswer = (picked?: number) => {
    if (!question) return null;
    if (question.kind === 'impression') {
      if (picked == null) return null;
      return {
        saidYes: picked === 1,
        canTolerate: question.canTolerate,
        correct: (picked === 1) === question.canTolerate,
        pole: question.pole,
        tolerancePercentile: question.tolerancePercentile,
        extremeValue: question.extremeValue,
      };
    }
    if (question.kind === 'compare') {
      if (picked == null) return null;
      return {
        choice: picked,
        higherIndex: question.higherIndex,
        correct: picked === question.higherIndex,
        means: question.means,
        cellMeans: question.cellMeans,
        diff: Math.abs(question.means[0] - question.means[1]),
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

  const submit = async (picked?: number) => {
    if (!trial || !question || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitError(null);
    const startedAt = startedAtRef.current;
    // Selections/choices only; deselects stay logged but aren't answers.
    const answers: { tMs: number }[] =
      question.kind === 'extreme'
        ? clicksRef.current.filter((c) => !c.deselected)
        : choicesRef.current;
    try {
      const response = await fetch(`${BACKEND_BASE}/study/responses`, {
        method: 'POST',
        // text/plain keeps this a CORS "simple request" (see backend).
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          participantId,
          mode: 'session',
          task: trial.task,
          trialIndex: index,
          stage: trial.stage,
          stageCount: trial.stageCount,
          blockIndex: trial.blockIndex,
          indexInBlock: trial.indexInBlock,
          species: trial.species.map((s) => ({
            taxonId: s.taxonId,
            scientificName: s.label,
          })),
          variable: trial.variableId,
          isControl: getStudyVariable(trial.variableId).isControl,
          units: UNITS,
          conditions: trial.scheme,
          design: trial.design,
          question:
            question.kind === 'compare'
              ? { id: 'which-higher-on-average' }
              : question.kind === 'impression'
                ? { id: 'can-tolerate', pole: question.pole }
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
      allReadyRef.current = false;
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
  // until both maps are ready and the intro is dismissed (the timer is running)
  // and while a submit is in flight, so an early or repeated press can't log a
  // bogus time or answer.
  const answerWith = (picked: number) => {
    if (startedAtRef.current == null || submittingRef.current) return;
    choicesRef.current.push({ tMs: elapsedSinceStart(), choice: picked });
    void submit(picked);
  };
  const handleKey = (key: string) => {
    if (question?.kind !== 'compare' && question?.kind !== 'impression') {
      return;
    }
    const lower = key.toLowerCase();
    if (lower !== 'f' && lower !== 'j') return;
    // Compare: F = Map A (0), J = Map B (1). Impression: F = Yes (1), J = No (0).
    if (question.kind === 'impression') answerWith(lower === 'f' ? 1 : 0);
    else answerWith(lower === 'f' ? 0 : 1);
  };
  const handleKeyRef = React.useRef(handleKey);
  handleKeyRef.current = handleKey;
  const dismissIntroRef = React.useRef(dismissIntro);
  dismissIntroRef.current = dismissIntro;
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey)
        return;
      if (introOpenRef.current) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          dismissIntroRef.current();
        }
        return;
      }
      handleKeyRef.current(event.key);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  if (!trial || !question) {
    return (
      <PageSurface hideFooter>
        <PageScrollContainer>
          <View style={styles.container}>
            <ThemedText>Thank you — that was the last one.</ThemedText>
          </View>
        </PageScrollContainer>
      </PageSurface>
    );
  }

  const intro = introText(trial);
  return (
    <PageSurface hideFooter>
      <PageScrollContainer>
        <View style={styles.container}>
          <ThemedText>
            {`Stage ${trial.stage + 1} of ${trial.stageCount} · trial ${trial.indexInBlock + 1} of ${trial.blockLength}`}
          </ThemedText>
          {introOpen ? (
            <View style={styles.intro}>
              <ThemedText>{intro.heading}</ThemedText>
              {intro.lines.map((line) => (
                <ThemedText key={line}>{line}</ThemedText>
              ))}
              <Button variant='primary' label='Start' onPress={dismissIntro} />
              <ThemedText>(or press Enter)</ThemedText>
            </View>
          ) : (
            <ThemedText>{questionText(trial)}</ThemedText>
          )}
          {variableDef ? (
            <View
              style={[
                styles.maps,
                introOpen && { opacity: 0, pointerEvents: 'none' },
              ]}
            >
              {trial.species.map((s, slot) => (
                <View key={slot} style={styles.slot}>
                  {question.kind === 'compare' ? (
                    <ThemedText>{MAP_LABELS[slot]}</ThemedText>
                  ) : null}
                  <StudyMap
                    // Keyed by slot, not species: the same map instance serves
                    // every trial, so it isn't rebuilt (WebGL/tiles reloaded).
                    taxonId={s.taxonId}
                    variable={variableDef}
                    units={UNITS}
                    scheme={trial.scheme}
                    legendRange='observed'
                    viewBox={s.viewBox}
                    prefetchTargets={upcoming}
                    height={mapHeight}
                    target={
                      question.kind === 'extreme' ? question.target : undefined
                    }
                    onSelect={handleSelect}
                    onReady={(verified) => markReady(s.taxonId, verified)}
                    onKey={handleKey}
                    noPopups={question.kind === 'impression'}
                  />
                </View>
              ))}
            </View>
          ) : (
            <ThemedText>Loading…</ThemedText>
          )}
          {!introOpen ? (
            <View style={styles.questions}>
              {question.kind === 'impression' ? (
                <View style={styles.ratings}>
                  <Button
                    variant='primary'
                    label='Yes (F)'
                    onPress={() => answerWith(1)}
                  />
                  <Button
                    variant='primary'
                    label='No (J)'
                    onPress={() => answerWith(0)}
                  />
                </View>
              ) : question.kind === 'compare' ? (
                <ThemedText>
                  F = Map A is higher, J = Map B is higher
                </ThemedText>
              ) : (
                <>
                  <ThemedText>
                    {selection
                      ? `${formatSelection(selection, variableDef?.units ?? '')} Click another dot to change it, or press Next.`
                      : 'No dot selected yet.'}
                  </ThemedText>
                  <Button
                    variant='primary'
                    label='Next'
                    disabled={selection == null}
                    onPress={() => void submit()}
                  />
                </>
              )}
              {submitError ? <ThemedText>{submitError}</ThemedText> : null}
            </View>
          ) : null}
        </View>
      </PageScrollContainer>
    </PageSurface>
  );
}

const styles = StyleSheet.create({
  container: { gap: 16, padding: 16 },
  intro: { gap: 12 },
  maps: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  slot: { flex: 1, minWidth: 280, gap: 8 },
  questions: { gap: 12 },
  ratings: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});

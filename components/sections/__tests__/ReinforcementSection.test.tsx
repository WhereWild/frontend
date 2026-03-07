import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { ReinforcementSection } from '../ReinforcementSection';
import type { ReinforcementState } from '@/hooks/species/useReinforcement';

function makeReinforcement(overrides: Partial<ReinforcementState> = {}): ReinforcementState {
  return {
    enabled: false,
    setEnabled: jest.fn(),
    markPresent: true,
    setMarkPresent: jest.fn(),
    feedbackLog: [],
    hasReinforcedHead: false,
    isReinforcedHeadStatusLoading: false,
    lastResult: null,
    submitFeedback: jest.fn().mockResolvedValue(null),
    resetHead: jest.fn().mockResolvedValue(undefined),
    save: jest.fn().mockResolvedValue(undefined),
    load: jest.fn().mockResolvedValue(undefined),
    refreshFeedbackLog: jest.fn().mockResolvedValue(undefined),
    busy: false,
    error: null,
    statusMessage: null,
    ...overrides,
  };
}

describe('ReinforcementSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the RL switch', () => {
    render(<ReinforcementSection reinforcement={makeReinforcement()} />);
    expect(screen.getByText('Reinforcement Learning')).toBeTruthy();
  });

  it('hides controls when disabled', () => {
    render(<ReinforcementSection reinforcement={makeReinforcement({ enabled: false })} />);
    expect(screen.queryByText('Feedback Mode')).toBeNull();
    expect(screen.queryByText('Save Head')).toBeNull();
  });

  it('shows controls when enabled', () => {
    render(<ReinforcementSection reinforcement={makeReinforcement({ enabled: true })} />);
    expect(screen.getByText('Feedback Mode')).toBeTruthy();
    expect(screen.getByText('Present')).toBeTruthy();
    expect(screen.getByText('Absent')).toBeTruthy();
    expect(screen.getByText('Save Head')).toBeTruthy();
    expect(screen.getByText('Load Head')).toBeTruthy();
    expect(screen.getByText('Reset')).toBeTruthy();
  });

  it('shows feedback count', () => {
    const log = [
      { lat: 1, lon: 2, present: true },
      { lat: 3, lon: 4, present: false },
    ];
    render(<ReinforcementSection reinforcement={makeReinforcement({ enabled: true, feedbackLog: log })} />);
    expect(screen.getByText('Feedback points: 2')).toBeTruthy();
  });

  it('shows last result scores', () => {
    const lastResult = {
      speciesKey: 42,
      feedbackCount: 3,
      point: { lat: 1, lon: 2 },
      originalScore: 0.456,
      reinforcedScore: 0.789,
    };
    render(
      <ReinforcementSection reinforcement={makeReinforcement({ enabled: true, lastResult })} />,
    );
    expect(screen.getByText('Last score: 0.456 → 0.789')).toBeTruthy();
  });

  it('shows error when present', () => {
    render(
      <ReinforcementSection
        reinforcement={makeReinforcement({ enabled: true, error: 'Something went wrong' })}
      />,
    );
    expect(screen.getByText('Something went wrong')).toBeTruthy();
  });

  it('fires save when Save Head is pressed', () => {
    const save = jest.fn().mockResolvedValue(undefined);
    const log = [{ lat: 1, lon: 2, present: true }];
    render(
      <ReinforcementSection reinforcement={makeReinforcement({ enabled: true, save, feedbackLog: log })} />,
    );
    fireEvent.press(screen.getByText('Save Head'));
    expect(save).toHaveBeenCalledWith();
  });

  it('fires load when Load Head is pressed', () => {
    const load = jest.fn().mockResolvedValue(undefined);
    render(
      <ReinforcementSection reinforcement={makeReinforcement({ enabled: true, load, hasReinforcedHead: true })} />,
    );
    fireEvent.press(screen.getByText('Load Head'));
    expect(load).toHaveBeenCalledWith();
  });

  it('disables load when reinforced head is unavailable', () => {
    const load = jest.fn().mockResolvedValue(undefined);
    render(
      <ReinforcementSection reinforcement={makeReinforcement({ enabled: true, load, hasReinforcedHead: false })} />,
    );
    fireEvent.press(screen.getByText('Load Head'));
    expect(load).not.toHaveBeenCalled();
  });

  it('fires resetHead when Reset is pressed', () => {
    const resetHead = jest.fn().mockResolvedValue(undefined);
    const log = [{ lat: 1, lon: 2, present: true }];
    render(
      <ReinforcementSection
        reinforcement={makeReinforcement({ enabled: true, resetHead, feedbackLog: log })}
      />,
    );
    fireEvent.press(screen.getByText('Reset'));
    expect(resetHead).toHaveBeenCalled();
  });
});

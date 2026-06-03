// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import { act } from '@testing-library/react-native';
import { create, type ReactTestRendererJSON } from 'react-test-renderer';
import { StyleSheet } from 'react-native';
import { UploadStepCard } from '@/components/upload/UploadStepCard';
import { Colors } from '@/constants/theme';

describe('UploadStepCard', () => {
  it('keeps stable action slot wrappers across loading state changes', () => {
    let renderer: ReturnType<typeof create> | undefined;

    act(() => {
      renderer = create(
        <UploadStepCard
          description='Upload raw observational data.'
          isLoading={false}
          label='Upload'
          loadingLabel='Processing upload...'
          palette={Colors.light}
          secondaryAction={{
            label: 'Download ZIP',
            onPress: jest.fn(),
          }}
          stepTitle='Step 1'
          onPress={jest.fn()}
        />,
      );
    });

    if (!renderer) {
      throw new Error('Renderer was not created.');
    }

    const stableRenderer = renderer;

    const getActionSlotSnapshot = (testID: string) => {
      const props = stableRenderer.root.findByProps({ testID }).props as
        | (ReactTestRendererJSON['props'] & { collapsable?: boolean })
        | undefined;

      return {
        collapsable: props?.collapsable,
        testID: props?.testID,
      };
    };

    const actionSlotIds = [
      'upload-step-card-primary-slot',
      'upload-step-card-primary-loading-slot',
      'upload-step-card-secondary-slot',
      'upload-step-card-secondary-loading-slot',
    ] as const;

    const snapshotActionSlots = () =>
      actionSlotIds.map((testID) => ({
        testID,
        props: getActionSlotSnapshot(testID),
      }));

    const initialActionSlots = snapshotActionSlots();

    initialActionSlots.forEach(({ props, testID }) => {
      expect(props?.collapsable).toBe(false);
      expect(props?.testID).toBe(testID);
    });

    act(() => {
      stableRenderer.update(
        <UploadStepCard
          description='Upload raw observational data.'
          isLoading={true}
          label='Upload'
          loadingLabel='Processing upload...'
          palette={Colors.light}
          secondaryAction={{
            label: 'Download ZIP',
            onPress: jest.fn(),
          }}
          stepTitle='Step 1'
          onPress={jest.fn()}
        />,
      );
    });

    expect(snapshotActionSlots()).toEqual(initialActionSlots);

    act(() => {
      stableRenderer.unmount();
    });
  });

  it('removes empty action slots from layout so visible actions stay centered', () => {
    let renderer: ReturnType<typeof create> | undefined;

    act(() => {
      renderer = create(
        <UploadStepCard
          description='Upload raw observational data.'
          isLoading={false}
          label='Upload'
          palette={Colors.light}
          stepTitle='Step 1'
          onPress={jest.fn()}
        />,
      );
    });

    if (!renderer) {
      throw new Error('Renderer was not created.');
    }

    const stableRenderer = renderer;
    const primarySlot = stableRenderer.root.findByProps({
      testID: 'upload-step-card-primary-slot',
    });
    const primaryLoadingSlot = stableRenderer.root.findByProps({
      testID: 'upload-step-card-primary-loading-slot',
    });
    const secondarySlot = stableRenderer.root.findByProps({
      testID: 'upload-step-card-secondary-slot',
    });
    const secondaryLoadingSlot = stableRenderer.root.findByProps({
      testID: 'upload-step-card-secondary-loading-slot',
    });

    expect(primarySlot.children.length).toBeGreaterThan(0);
    expect(
      StyleSheet.flatten(primarySlot.props.style)?.position,
    ).toBeUndefined();
    expect(StyleSheet.flatten(primaryLoadingSlot.props.style)?.position).toBe(
      'absolute',
    );
    expect(StyleSheet.flatten(secondarySlot.props.style)?.position).toBe(
      'absolute',
    );
    expect(StyleSheet.flatten(secondaryLoadingSlot.props.style)?.position).toBe(
      'absolute',
    );

    act(() => {
      stableRenderer.unmount();
    });
  });
});

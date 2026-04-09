import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { Platform, Text, View } from 'react-native';
import {
  NativePortalHost,
  NativePortalProvider,
  useNativePortalHost,
} from '../NativePortalHost';

function PortalProbe({ visible }: { visible: boolean }) {
  const host = useNativePortalHost();

  React.useEffect(() => {
    if (!host || !visible) {
      return undefined;
    }

    host.upsertPortal({
      id: 'probe',
      accessibilityLabel: 'Probe portal',
      children: <Text>Portal content</Text>,
    });

    return () => {
      host.removePortal('probe');
    };
  }, [host, visible]);

  return null;
}

describe('NativePortalHost', () => {
  const originalPlatformDescriptor = Object.getOwnPropertyDescriptor(
    Platform,
    'OS',
  );

  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      get: () => 'ios',
    });
  });

  afterEach(() => {
    if (originalPlatformDescriptor) {
      Object.defineProperty(Platform, 'OS', originalPlatformDescriptor);
    }
  });

  it('keeps the host mounted even when there are no portal entries', () => {
    const { UNSAFE_root } = render(
      <NativePortalProvider>
        <NativePortalHost />
      </NativePortalProvider>,
    );

    const hostViews = UNSAFE_root.findAllByType(View).filter((node) => {
      const styleEntries = Array.isArray(node.props.style)
        ? node.props.style
        : [node.props.style];

      return styleEntries.some(
        (style) =>
          style?.position === 'absolute' &&
          style?.top === 0 &&
          style?.left === 0 &&
          style?.right === 0 &&
          style?.bottom === 0 &&
          style?.zIndex === 100000,
      );
    });

    expect(hostViews).toHaveLength(1);
    expect(screen.queryByText('Portal content')).toBeNull();
  });

  it('renders portal entries inside a single stable content wrapper', () => {
    render(
      <NativePortalProvider>
        <NativePortalHost />
        <PortalProbe visible />
      </NativePortalProvider>,
    );

    expect(screen.getByLabelText('Probe portal')).toBeTruthy();
    expect(screen.getByText('Portal content')).toBeTruthy();
  });
});

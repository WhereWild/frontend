import { render, screen } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';
import {
  PageHeaderPortalProvider,
  useActivePageHeaderConfig,
  usePageHeaderConfig,
} from '../PageHeaderPortal';

let mockPathname = '/';
const mockBack = jest.fn();
const mockCanGoBack = jest.fn(() => true);
const mockPush = jest.fn();
const mockRouter = { back: mockBack, canGoBack: mockCanGoBack, push: mockPush };

jest.mock('expo-router', () => ({
  usePathname: () => mockPathname,
  useRouter: () => mockRouter,
}));

function ActiveConfigProbe() {
  const config = useActivePageHeaderConfig();
  return <Text testID="active-config">{config.searchValue ?? ''}</Text>;
}

function SearchHeaderConfig() {
  const config = React.useMemo(() => ({ searchValue: 'frog' }), []);
  usePageHeaderConfig(config);
  return null;
}

function TestHarness({ includeSearch }: { includeSearch: boolean }) {
  return (
    <PageHeaderPortalProvider>
      {includeSearch ? <SearchHeaderConfig /> : null}
      <ActiveConfigProbe />
    </PageHeaderPortalProvider>
  );
}

describe('PageHeaderPortal', () => {
  beforeEach(() => {
    mockPathname = '/';
    mockBack.mockClear();
    mockCanGoBack.mockReturnValue(true);
    mockPush.mockClear();
  });

  it('prefers the config registered for the current pathname', () => {
    mockPathname = '/search';
    const { rerender } = render(<TestHarness includeSearch />);

    expect(screen.getByTestId('active-config').props.children).toBe('frog');

    mockPathname = '/';
    rerender(<TestHarness includeSearch />);

    expect(screen.getByTestId('active-config').props.children).toBe('');
  });
});

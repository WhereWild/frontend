import React from 'react';
import { act, render } from '@testing-library/react-native';
import { Colors } from '@/constants/theme';
import {
  getOptionRowBackground,
  getSelectFieldColors,
  useSelectDropdown,
} from '../inputs/selectFieldHelpers';
import { Dimensions, type View } from 'react-native';

describe('selectFieldHelpers', () => {
  const palette = Colors.light;

  describe('getSelectFieldColors', () => {
    it('returns danger-focused colors when error is present', () => {
      const colors = getSelectFieldColors(palette, {
        disabled: false,
        errorMessage: 'Required',
        isOpen: false,
      });

      expect(colors.backgroundColor).toBe(palette.background.danger.default);
      expect(colors.placeholderColor).toBe(palette.text.danger.onDangerSecondary);
      expect(colors.textColor).toBe(palette.text.danger.onDanger);
    });

    it('returns disabled colors when the field is disabled', () => {
      const colors = getSelectFieldColors(palette, {
        disabled: true,
        errorMessage: undefined,
        isOpen: true,
      });

      expect(colors.borderColor).toBe(palette.border.brand.default);
      expect(colors.backgroundColor).toBe(palette.background.disabled.default);
      expect(colors.iconColor).toBe(palette.icon.disabled.onDisabled);
    });
  });

  describe('getOptionRowBackground', () => {
    const colors = getSelectFieldColors(palette, {
      disabled: false,
      errorMessage: undefined,
      isOpen: false,
    });

    it('prefers the selected background', () => {
      expect(
        getOptionRowBackground(colors, {
          selected: true,
          disabled: false,
          pressed: false,
          hovered: false,
        }),
      ).toBe(colors.optionSelectedBackground);
    });

    it('uses the pressed background when active and not disabled', () => {
      expect(
        getOptionRowBackground(colors, {
          selected: false,
          disabled: false,
          pressed: true,
          hovered: false,
        }),
      ).toBe(colors.optionPressedBackground);
    });

    it('falls back to the hover background when hovered', () => {
      expect(
        getOptionRowBackground(colors, {
          selected: false,
          disabled: false,
          pressed: false,
          hovered: true,
        }),
      ).toBe(colors.optionHoverBackground);
    });
  });

  describe('useSelectDropdown', () => {
    type HookApi = ReturnType<typeof useSelectDropdown>;

    const HookHarness = React.forwardRef<HookApi, { disabled: boolean }>((props, ref) => {
      const api = useSelectDropdown(props.disabled);
      React.useImperativeHandle(ref, () => api, [api]);
      return null;
    });
    HookHarness.displayName = 'HookHarness';

    const setupHook = (disabled = false) => {
      const ref = React.createRef<HookApi>();
      const rendered = render(<HookHarness disabled={disabled} ref={ref} />);
      const getApi = () => {
        if (!ref.current) {
          throw new Error('Hook not initialized');
        }
        return ref.current;
      };
      const rerender = (nextDisabled: boolean) =>
        rendered.rerender(<HookHarness disabled={nextDisabled} ref={ref} />);
      return {
        getApi,
        rerender,
        unmount: rendered.unmount,
      };
    };

    it('returns early when no trigger ref is attached', () => {
      const { getApi, unmount } = setupHook();
      act(() => {
        getApi().updateDropdownPosition();
      });
      expect(getApi().dropdownPosition).toBeUndefined();
      unmount();
    });

    it('reads coordinates from measureInWindow when available', () => {
      const { getApi, unmount } = setupHook();
      const triggerRef = getApi().triggerRef;
      act(() => {
        triggerRef.current = {
          measureInWindow: (cb: (x: number, y: number, width: number, height: number) => void) =>
            cb(10, 20, 120, 48),
        } as unknown as View;
        getApi().updateDropdownPosition();
      });
      expect(getApi().dropdownPosition).toEqual({ x: 10, y: 20, width: 120, height: 48 });
      unmount();
    });

    it('falls back when measureInWindow is missing', () => {
      const { getApi, unmount } = setupHook();
      act(() => {
        getApi().triggerRef.current = {} as unknown as View;
        getApi().updateDropdownPosition();
      });
      expect(getApi().dropdownPosition).toEqual({ x: 0, y: 0, width: 0, height: 0 });
      unmount();
    });

    it('schedules a fallback when measurement does not resolve', () => {
      jest.useFakeTimers();
      const { getApi, unmount } = setupHook();
      const triggerRef = getApi().triggerRef;
      act(() => {
        triggerRef.current = {
          measureInWindow: () => {
            // intentionally no callback invocation
          },
        } as unknown as View;
        getApi().updateDropdownPosition();
      });
      expect(getApi().dropdownPosition).toBeUndefined();
      act(() => {
        jest.runAllTimers();
      });
      expect(getApi().dropdownPosition).toEqual({ x: 0, y: 0, width: 0, height: 0 });
      jest.useRealTimers();
      unmount();
    });

    it('does not open when disabled', () => {
      const { getApi, unmount } = setupHook(true);
      act(() => {
        getApi().toggleDropdown();
      });
      expect(getApi().isOpen).toBe(false);
      unmount();
    });

    it('re-measures on layout when open and closes again via toggle', () => {
      const { getApi, unmount } = setupHook();
      const triggerRef = getApi().triggerRef;
      const measure = jest.fn((cb: (x: number, y: number, width: number, height: number) => void) =>
        cb(0, 0, 0, 0),
      );
      act(() => {
        triggerRef.current = { measureInWindow: measure } as unknown as View;
        getApi().toggleDropdown();
      });
      expect(getApi().isOpen).toBe(true);
      measure.mockClear();
      act(() => {
        getApi().handleFieldLayout();
      });
      expect(measure).toHaveBeenCalledTimes(1);
      act(() => {
        getApi().toggleDropdown();
      });
      expect(getApi().isOpen).toBe(false);
      unmount();
    });

    it('closes automatically when the component becomes disabled', () => {
      const { getApi, rerender, unmount } = setupHook(false);
      const triggerRef = getApi().triggerRef;
      act(() => {
        triggerRef.current = {
          measureInWindow: (cb: (x: number, y: number, width: number, height: number) => void) => cb(0, 0, 0, 0),
        } as unknown as View;
        getApi().toggleDropdown();
      });
      expect(getApi().isOpen).toBe(true);
      act(() => {
        rerender(true);
      });
      expect(getApi().isOpen).toBe(false);
      unmount();
    });

    it('registers and cleans up the Dimensions listener while open', () => {
      const removeListener = jest.fn();
      const addEventListenerSpy = jest
        .spyOn(Dimensions, 'addEventListener')
        .mockReturnValue({ remove: removeListener } as any);

      const { getApi, unmount } = setupHook();
      const triggerRef = getApi().triggerRef;
      act(() => {
        triggerRef.current = {
          measureInWindow: (cb: (x: number, y: number, width: number, height: number) => void) => cb(0, 0, 0, 0),
        } as unknown as View;
        getApi().toggleDropdown();
      });
      expect(addEventListenerSpy).toHaveBeenCalledWith('change', expect.any(Function));

      act(() => {
        getApi().toggleDropdown();
      });
      expect(removeListener).toHaveBeenCalled();

      addEventListenerSpy.mockRestore();
      unmount();
    });
  });
});

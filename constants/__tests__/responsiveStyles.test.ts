import { getResponsiveContentContainerStyle, getResponsiveGapStyle } from '@/constants/responsiveStyles';

describe('responsiveStyles', () => {
  const responsive = {
    marginHorizontal: 24,
    gap: 32,
  };

  describe('getResponsiveContentContainerStyle', () => {
    it('returns default top and horizontal spacing', () => {
      expect(getResponsiveContentContainerStyle(responsive)).toEqual({
        width: '100%',
        paddingHorizontal: 24,
        paddingTop: 32,
      });
    });

    it('supports optional bottom padding and content gap', () => {
      expect(
        getResponsiveContentContainerStyle(responsive, {
          includeBottomPadding: true,
          includeGap: true,
        }),
      ).toEqual({
        width: '100%',
        paddingHorizontal: 24,
        paddingTop: 32,
        paddingBottom: 32,
        gap: 32,
      });
    });

    it('supports disabling horizontal padding', () => {
      expect(
        getResponsiveContentContainerStyle(responsive, {
          includeHorizontalPadding: false,
          includeGap: true,
        }),
      ).toEqual({
        width: '100%',
        paddingTop: 32,
        gap: 32,
      });
    });

    it('supports disabling top padding', () => {
      expect(
        getResponsiveContentContainerStyle(responsive, {
          includeTopPadding: false,
        }),
      ).toEqual({
        width: '100%',
        paddingHorizontal: 24,
      });
    });

    it('supports disabling width', () => {
      expect(
        getResponsiveContentContainerStyle(responsive, {
          includeWidth: false,
          includeTopPadding: false,
        }),
      ).toEqual({
        paddingHorizontal: 24,
      });
    });
  });

  describe('getResponsiveGapStyle', () => {
    it('returns a gap-only style object', () => {
      expect(getResponsiveGapStyle({ gap: 32 })).toEqual({
        gap: 32,
      });
    });
  });
});

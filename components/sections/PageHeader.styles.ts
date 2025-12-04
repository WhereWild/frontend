import { StyleSheet } from 'react-native';
import { Shadows, Size } from '@/constants/theme';

export const pageHeaderStyles = StyleSheet.create({
  container: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    paddingHorizontal: Size.space['800'],
    paddingVertical: Size.space['200'],
    gap: Size.space['400'],
  },
  logoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Size.space['200'],
  },
  logo: {
    width: Size.space['1600'],
    height: Size.space['1600'],
  },
  logoMobile: {
    width: Size.space['1200'],
    height: Size.space['1200'],
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: Size.space['400'],
  },
  searchRowDesktop: {
    minWidth: Size.space['8000'],
  },
  mobileSearchRow: {
    minWidth: 0,
    gap: Size.space['200'],
  },
  searchWrapper: {
    position: 'relative',
    flex: 1,
  },
  actionsWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Size.space['400'],
    flexWrap: 'wrap',
  },
  mobileContainer: {
    width: '100%',
    paddingHorizontal: 0,
    paddingVertical: 0,
    gap: Size.space['200'],
    position: 'relative',
  },
  mobileContainerRaised: {
    zIndex: 2,
    elevation: 2,
  },
  mobileToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Size.space['200'],
    alignSelf: 'stretch',
    paddingVertical: Size.space['200'],
    paddingHorizontal: Size.space['200'],
  },
  mobileLogoSection: {
    flexShrink: 0,
  },
  mobileActionsCard: {
    borderRadius: Size.radius['400'],
    padding: Size.space['200'],
    gap: Size.space['200'],
    alignItems: 'flex-start',
    alignSelf: 'flex-end',
    position: 'absolute',
    zIndex: 10,
    ...Shadows.dropShadow200.style,
  },
  mobileActionButtonWrapper: {
    alignSelf: 'flex-start',
  },
  mobileActionButton: {
    width: '100%',
  },
});

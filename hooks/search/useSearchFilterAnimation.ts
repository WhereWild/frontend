import { Time, getReactNativeEasing } from '@/constants/theme';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform } from 'react-native';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

type UseSearchFilterAnimationParams = {
  filterVisible: boolean;
  slideOffset: number;
};

export function useSearchFilterAnimation({
  filterVisible,
  slideOffset,
}: UseSearchFilterAnimationParams) {
  const filterTranslateX = useRef(new Animated.Value(0));
  const filterTranslateY = useRef(new Animated.Value(0));
  const filterOpacity = useRef(new Animated.Value(1));
  const filterShouldStackRef = useRef(false);
  const hasInitializedRef = useRef(false);
  const [isFilterCollapsed, setIsFilterCollapsed] = useState(!filterVisible);

  const prepareFilterVisibilityToggle = useCallback((shouldStack: boolean) => {
    filterShouldStackRef.current = shouldStack;
  }, []);

  useEffect(() => {
    const translateX = filterTranslateX.current;
    const translateY = filterTranslateY.current;
    const opacity = filterOpacity.current;
    let showAnimation: Animated.CompositeAnimation | null = null;
    let hideAnimation: Animated.CompositeAnimation | null = null;

    const shouldStack = filterShouldStackRef.current;
    const hiddenTranslateX = shouldStack ? 0 : slideOffset;
    const hiddenTranslateY = shouldStack ? -slideOffset : 0;

    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      setIsFilterCollapsed(!filterVisible);
      translateX.setValue(filterVisible ? 0 : hiddenTranslateX);
      translateY.setValue(filterVisible ? 0 : hiddenTranslateY);
      opacity.setValue(filterVisible ? 1 : 0);
      return;
    }

    if (filterVisible) {
      setIsFilterCollapsed(false);
      translateX.setValue(hiddenTranslateX);
      translateY.setValue(hiddenTranslateY);
      opacity.setValue(0);

      showAnimation = Animated.parallel([
        Animated.timing(translateX, {
          toValue: 0,
          duration: Time.duration.medium,
          easing: getReactNativeEasing('out'),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: Time.duration.medium,
          easing: getReactNativeEasing('out'),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: Time.duration.medium,
          easing: getReactNativeEasing('out'),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]);

      showAnimation.start();

      return () => {
        showAnimation?.stop();
      };
    }

    setIsFilterCollapsed(false);

    hideAnimation = Animated.parallel([
      Animated.timing(translateX, {
        toValue: hiddenTranslateX,
        duration: Time.duration.medium,
        easing: getReactNativeEasing('in'),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(translateY, {
        toValue: hiddenTranslateY,
        duration: Time.duration.medium,
        easing: getReactNativeEasing('in'),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: Time.duration.medium,
        easing: getReactNativeEasing('in'),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]);

    hideAnimation.start(({ finished }) => {
      if (finished) {
        setIsFilterCollapsed(true);
      }
    });

    return () => {
      hideAnimation?.stop();
    };
  }, [filterVisible, slideOffset]);

  const animatedFilterStyle = useMemo(
    () => ({
      opacity: filterOpacity.current,
      transform: [
        { translateX: filterTranslateX.current },
        { translateY: filterTranslateY.current },
      ],
    }),
    [],
  );

  return {
    animatedFilterStyle,
    isFilterCollapsed,
    prepareFilterVisibilityToggle,
  };
}

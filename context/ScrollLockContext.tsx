import React from 'react';

type ScrollLockContextValue = {
  lockScroll: () => void;
  unlockScroll: () => void;
};

const ScrollLockContext = React.createContext<ScrollLockContextValue>({
  lockScroll: () => {},
  unlockScroll: () => {},
});

export function useScrollLock() {
  return React.useContext(ScrollLockContext);
}

export { ScrollLockContext };

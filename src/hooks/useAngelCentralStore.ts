import { useState, useEffect } from 'react';
import { centralStore, AngelCentralState } from '../services/centralStore';
import { PrimaryNavItem, CompanionOrbState, StudioId } from '../types/angel';

export function useAngelCentralStore() {
  const [storeState, setStoreState] = useState<AngelCentralState>(centralStore.getState());

  useEffect(() => {
    const unsubscribe = centralStore.subscribe(() => {
      setStoreState(centralStore.getState());
    });
    return unsubscribe;
  }, []);

  return {
    ...storeState,
    setCurrentDestination: (navId: PrimaryNavItem) => centralStore.setCurrentDestination(navId),
    setOrbState: (orbState: CompanionOrbState) => centralStore.setOrbState(orbState),
    setActiveStudio: (studioId: StudioId) => centralStore.setActiveStudio(studioId),
    syncState: () => centralStore.syncState(),
  };
}

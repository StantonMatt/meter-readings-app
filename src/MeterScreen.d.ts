import React from "react";
import { MeterData } from "./utils/readingUtils";

declare module "./MeterScreen" {
  export interface MeterScreenProps {
    meter: MeterData;
    currentIndex: number;
    totalMeters: number;
    onHome: () => void;
    onPrev: () => void;
    onNext: () => void;
    onFinish: () => void;
    onReadingChange: (meterId: string | number, reading: string) => void;
    onConfirmationChange: (
      meterId: string | number,
      isConfirmed: boolean
    ) => void;
    pendingNavigation: (() => void) | null;
    setPendingNavigation: React.Dispatch<
      React.SetStateAction<(() => void) | null>
    >;
    setNavigationHandledByChild: React.Dispatch<React.SetStateAction<boolean>>;
    selectedMonth: number;
    selectedYear: number;
    onNavigationAttempt: (navigationCallback: () => void) => void;
  }

  const MeterScreen: React.FC<MeterScreenProps>;
  export default MeterScreen;
}

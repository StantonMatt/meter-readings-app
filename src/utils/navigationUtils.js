/**
 * Navigation utilities for the app
 */

/**
 * Create navigation handlers with confirmation dialog
 * @param {number} currentIndex - Current meter index
 * @param {Array} combinedMeters - Array of meter objects
 * @param {Object} readingsState - Current state of readings
 * @param {Function} setCurrentIndex - State setter for current index
 * @param {Function} setShowConfirmDialog - State setter for confirm dialog
 * @param {Function} setPendingNavigation - State setter for pending navigation
 * @returns {Object} Object with navigation handler functions
 */
export const createNavigationHandlers = (
  currentIndex,
  combinedMeters,
  readingsState,
  setCurrentIndex,
  setShowConfirmDialog,
  setPendingNavigation
) => {
  /**
   * Check if there's an unconfirmed reading before navigation
   * @param {Function} navigationFunction - Function to execute after check
   */
  const navigateWithConfirmationCheck = (navigationFunction) => {
    // Check if there's an unconfirmed reading
    if (currentIndex >= 0 && currentIndex < combinedMeters.length) {
      const currentMeter = combinedMeters[currentIndex];
      const reading = readingsState[currentMeter.ID];

      if (reading?.reading && !reading.isConfirmed) {
        setShowConfirmDialog(true);
        setPendingNavigation(() => navigationFunction);
        return;
      }
    }
    // If no unconfirmed reading, navigate directly
    navigationFunction();
  };

  // Return all navigation handlers
  return {
    /**
     * Handle selecting a specific meter
     * @param {number} index - Meter index to navigate to
     */
    handleSelectMeter: (index) => {
      navigateWithConfirmationCheck(() => setCurrentIndex(index));
    },

    /**
     * Handle going to home screen
     */
    handleHomeClick: () => {
      navigateWithConfirmationCheck(() => setCurrentIndex(null));
    },

    /**
     * Handle going to summary screen
     */
    handleGoToSummary: () => {
      navigateWithConfirmationCheck(() => setCurrentIndex(combinedMeters.length + 1));
    },
    
    /**
     * Handle navigating to previous meter
     */
    handlePreviousMeter: () => {
      navigateWithConfirmationCheck(() => setCurrentIndex(currentIndex - 1));
    },
    
    /**
     * Handle navigating to next meter
     */
    handleNextMeter: () => {
      navigateWithConfirmationCheck(() => setCurrentIndex(currentIndex + 1));
    }
  };
};
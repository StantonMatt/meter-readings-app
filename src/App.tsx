// App.tsx
import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  useNavigate,
  useLocation,
} from "react-router-dom";
import { onAuthStateChanged, getAuth, signOut } from "firebase/auth";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  query,
  where,
  setDoc,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";

// Components
import Layout from "./Layout";
import HomeScreen from "./HomeScreen";
import MeterScreen from "./MeterScreen";
import FinalCheckScreen from "./FinalCheckScreen";
import SummaryScreen from "./SummaryScreen";
import LoginScreen from "./LoginScreen";
import RoutesScreen from "./RoutesScreen";
// Remove imports for non-existent files
// import EmailPreview from "./EmailPreview";
// import EmailPreviewTable from "./EmailPreviewTable";

// Data and Config
import routeData from "./data/routes/sl-pp/ruta_sl-pp.json";
import {
  db,
  storage,
  auth,
  functions,
  appCheck,
  appCheckInitialized,
} from "./firebase-config";

// Utilities
import { months, getPreviousMonthYear } from "./utils/dateUtils";
import {
  calculateMonthlyConsumption,
  findFirstPendingMeter,
  generateCSV,
  MeterData,
  ReadingsState,
} from "./utils/readingUtils";
import { generateEmailContent } from "./utils/emailUtils";
import {
  loadPreviousReadings,
  initializeFirebaseData,
} from "./services/firebaseService";

interface RouteData {
  id: string;
  name: string;
  totalMeters: number;
  [key: string]: any;
}

// Implement the navigation handlers function directly in App.tsx
// This replaces the import from navigationUtils
interface NavigationHandlers {
  handleSelectMeter: (index: number) => void;
  handleHomeClick: () => void;
  handleGoToSummary: () => void;
  handlePreviousMeter: () => void;
  handleNextMeter: () => void;
}

function App(): JSX.Element {
  // Core state
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const [submittedReadings, setSubmittedReadings] = useState<any[]>([]);
  const [availableRoutes, setAvailableRoutes] = useState<RouteData[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<RouteData | null>(null);
  const [previousReadings, setPreviousReadings] = useState<any[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [readingsData, setReadingsData] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [authChecked, setAuthChecked] = useState<boolean>(false);
  const [isAuthStateReady, setIsAuthStateReady] = useState<boolean>(false);

  // UI state
  const [pendingNavigation, setPendingNavigation] = useState<
    (() => void) | null
  >(null);
  const [navigationHandledByChild, setNavigationHandledByChild] =
    useState<boolean>(false);

  // Date selection state
  const [selectedMonth, setSelectedMonth] = useState<number>(() => {
    const currentDate = new Date();
    return currentDate.getMonth();
  });

  const [selectedYear, setSelectedYear] = useState<number>(() => {
    const currentDate = new Date();
    return currentDate.getFullYear();
  });

  // Add this new state variable to track the last viewed meter
  const [lastViewedMeterIndex, setLastViewedMeterIndex] = useState<number>(
    () => {
      // Initialize from localStorage if available
      const saved = localStorage.getItem("lastViewedMeterIndex");
      return saved ? parseInt(saved, 10) : 0;
    }
  );

  // Calculate combined meters data
  const combinedMeters = useMemo(() => {
    return routeData.map((meter) => {
      // Check if readingsData is an array before using find
      const previousReadings = Array.isArray(readingsData)
        ? readingsData.find(
            (reading) => reading.ID.toString() === meter.ID.toString()
          )
        : null;
      if (previousReadings) {
        const {
          monthlyConsumption,
          averageConsumption,
          estimatedReading,
          monthsEstimated,
        } = calculateMonthlyConsumption(previousReadings);
        return {
          ...meter,
          readings: previousReadings,
          monthlyConsumption,
          averageConsumption,
          estimatedReading,
          monthsEstimated,
        };
      }
      return {
        ...meter,
        readings: {},
        monthlyConsumption: [],
        averageConsumption: 0,
        estimatedReading: null,
        monthsEstimated: 0,
      };
    }) as MeterData[];
  }, [routeData, readingsData]);

  // Initialize readings state from localStorage
  const [readingsState, setReadingsState] = useState<ReadingsState>(() => {
    const initialState: ReadingsState = {};
    routeData.forEach((meter) => {
      const reading = localStorage.getItem(`meter_${meter.ID}_reading`);
      const isConfirmed =
        localStorage.getItem(`meter_${meter.ID}_confirmed`) === "true";
      if (reading || isConfirmed) {
        initialState[meter.ID] = {
          reading: reading || "",
          isConfirmed: isConfirmed,
        };
      }
    });
    return initialState;
  });

  // Function to create navigation handlers directly in App.tsx
  const createNavigationHandlersInternal =
    useCallback((): NavigationHandlers => {
      const navigateWithConfirmationCheck = (
        navigationFunction: () => void
      ): void => {
        // Always navigate directly, no dialogs
        navigationFunction();
      };

      // Return all navigation handlers
      return {
        handleSelectMeter: (index: number): void => {
          setCurrentIndex(index);
          // Remember this position
          setLastViewedMeterIndex(index);
          localStorage.setItem("lastViewedMeterIndex", index.toString());
        },

        handleHomeClick: (): void => {
          // If we're on a meter screen, save the position before navigating away
          if (currentIndex !== null && currentIndex < combinedMeters.length) {
            setLastViewedMeterIndex(currentIndex);
            localStorage.setItem(
              "lastViewedMeterIndex",
              currentIndex.toString()
            );
          }
          setCurrentIndex(null);
        },

        handleGoToSummary: (): void => {
          setCurrentIndex(combinedMeters.length + 1);
        },

        handlePreviousMeter: (): void => {
          if (currentIndex === null) return;
          const newIndex = currentIndex - 1;
          if (newIndex >= 0) {
            setCurrentIndex(newIndex);
            setLastViewedMeterIndex(newIndex);
            localStorage.setItem("lastViewedMeterIndex", newIndex.toString());
          }
        },

        handleNextMeter: (): void => {
          if (currentIndex === null) return;
          const newIndex = currentIndex + 1;
          setCurrentIndex(newIndex);

          // Only save if we're still on a meter screen
          if (newIndex < combinedMeters.length) {
            setLastViewedMeterIndex(newIndex);
            localStorage.setItem("lastViewedMeterIndex", newIndex.toString());
          }
        },
      };
    }, [currentIndex, combinedMeters.length]);

  // Use our internal function instead of the imported one
  const {
    handleSelectMeter,
    handleHomeClick,
    handleGoToSummary,
    handlePreviousMeter,
    handleNextMeter,
  } = useMemo(
    () => createNavigationHandlersInternal(),
    [createNavigationHandlersInternal]
  );

  // Authentication effect
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setIsAuthStateReady(true);

      if (user) {
        // User is logged in
        setUser(user);

        // Store the saved state in a variable but don't apply it immediately
        let savedStateToRestore = null;

        try {
          const savedState = localStorage.getItem("appState");
          if (savedState) {
            savedStateToRestore = JSON.parse(savedState);
            console.log(
              "Found saved session state, will restore after routes load"
            );
          }
        } catch (error) {
          console.error("Error parsing saved session:", error);
        }

        // Load routes first - don't try to restore state here
        // The routes will be loaded by the useEffect for routes

        // Store the saved state in a ref or state so it can be used after routes load
        if (savedStateToRestore) {
          setSavedStateToRestore(savedStateToRestore);
        }
      } else {
        // User is logged out
        setUser(null);
        setCurrentIndex(0);
        setSavedStateToRestore(null);
      }
    });

    return () => unsubscribe();
  }, []);

  // Add this new state
  const [savedStateToRestore, setSavedStateToRestore] = useState(null);

  // Add a new effect that handles restoration AFTER routes are loaded
  useEffect(() => {
    const restoreSavedState = async () => {
      // Only proceed if we have saved state AND routes are available
      if (
        savedStateToRestore &&
        availableRoutes.length > 0 &&
        savedStateToRestore.selectedRoute
      ) {
        console.log("Routes are loaded, now restoring saved session state");

        // Find the matching route object from available routes
        const matchingRoute = availableRoutes.find(
          (route) => route.id === savedStateToRestore.selectedRoute.id
        );

        if (matchingRoute) {
          // Now it's safe to select the route
          await handleRouteSelect(matchingRoute);

          // After a short delay to let route data load, restore the meter index
          setTimeout(() => {
            if (savedStateToRestore.currentIndex !== undefined) {
              setCurrentIndex(savedStateToRestore.currentIndex);
              console.log(
                `Restored to meter index: ${savedStateToRestore.currentIndex}`
              );
            }

            // Clear the saved state to restore since we've handled it
            setSavedStateToRestore(null);
          }, 500);
        }
      }
    };

    restoreSavedState();
  }, [availableRoutes, savedStateToRestore]);

  // Load routes effect
  useEffect(() => {
    if (!user) return;

    let isMounted = true;

    const loadRoutes = async () => {
      try {
        console.log("Loading routes...");
        const routesRef = collection(db, "routes");
        const routesSnapshot = await getDocs(routesRef);

        const loadedRoutes = routesSnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name || "Unnamed Route",
            totalMeters: data.totalMeters || 0,
            meters: data.meters || [],
            lastUpdated: data.lastUpdated || null,
          };
        });

        if (isMounted) {
          console.log("Setting available routes:", loadedRoutes);
          setAvailableRoutes(loadedRoutes);

          // Auto-select first route if none is selected and we have routes
          if (loadedRoutes.length > 0 && !selectedRoute) {
            setSelectedRoute(loadedRoutes[0]);
          }

          setIsLoading(false);
        }
      } catch (error) {
        console.error("Error loading routes:", error);
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    const initializeAndLoadRoutes = async () => {
      // Always initialize data on login, regardless of whether it's been done this session
      try {
        console.log("Initializing Firebase data on login");
        // First initialize Firebase with data - do this every login
        await initializeFirebaseData(auth, db, appCheckInitialized);

        // Then load routes
        await loadRoutes();
      } catch (error) {
        console.error("Error during initialization:", error);
        if (isMounted) {
          // Even if initialization fails, try to load routes
          try {
            await loadRoutes();
          } catch (loadError) {
            console.error(
              "Error loading routes after init failure:",
              loadError
            );
          }
          setIsLoading(false);
        }
      }
    };

    initializeAndLoadRoutes();

    return () => {
      isMounted = false;
    };
  }, [user]); // Remove selectedRoute from dependencies to prevent reinitialization

  // Setup admin effect
  useEffect(() => {
    const setupAdmin = async (): Promise<void> => {
      if (!user) return;

      try {
        // Check if admin doc already exists first
        const adminRef = doc(db, "admins", user.uid);
        const adminDoc = await getDoc(adminRef);

        // Only try to create if it doesn't exist
        if (!adminDoc.exists()) {
          console.log("Creating admin document for user:", user.uid);
          await setDoc(adminRef, {
            isAdmin: true,
            email: user.email,
            createdAt: new Date(),
          });
          console.log("Admin setup complete");
        } else {
          console.log("Admin document already exists");
        }
      } catch (error) {
        // Just log the error without showing it to the user
        console.log("Note: Admin setup skipped -", (error as Error).message);
      }
    };

    // Only run once when user logs in
    const adminSetupKey = `admin_setup_${user?.uid}`;
    if (user && !localStorage.getItem(adminSetupKey)) {
      setupAdmin();
      localStorage.setItem(adminSetupKey, "true");
    }
  }, [user]);

  // Handler for date changes
  const handleDateChange = (month: number, year: number): void => {
    setSelectedMonth(month);
    setSelectedYear(year);
  };

  // Handler for starting the readings process
  const handleStartClick = async (): Promise<void> => {
    try {
      setIsLoading(true);

      // Load all 5 months of readings
      const result = await loadPreviousReadings();
      const readingsData = result.readings || [];
      setReadingsData(readingsData);

      // Update state
      setPreviousReadings(readingsData);
      // Use the saved meter index if available, otherwise start at 0
      setCurrentIndex(lastViewedMeterIndex || 0);
    } catch (error) {
      console.error("Error in handleStartClick:", error);
      setError("Failed to load route data. Using local data.");
      setCurrentIndex(lastViewedMeterIndex || 0);
    } finally {
      setIsLoading(false);
    }
  };

  // Handler for uploading readings
  const handleUploadReadings = async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      // Upload readings to Firebase
      const readingsToUpload = combinedMeters.map((meter) => {
        return {
          ADDRESS: meter.ADDRESS,
          ...meter.readings,
          currentReading: readingsState[meter.ID]?.reading || "---",
          ID: meter.ID,
        };
      });

      const uploadedReadings = await initializeFirebaseData(
        auth,
        db,
        appCheckInitialized
      );

      // Clear all readings from localStorage
      combinedMeters.forEach((meter) => {
        const readingKey = "meter_" + meter.ID + "_reading";
        const confirmedKey = "meter_" + meter.ID + "_confirmed";
        const verificationKey = "meter_" + meter.ID + "_verification";

        localStorage.removeItem(readingKey);
        localStorage.removeItem(confirmedKey);
        localStorage.removeItem(verificationKey);
      });

      // Reset readings state
      setReadingsState({});
      setCurrentIndex(combinedMeters.length);
      setSubmittedReadings([uploadedReadings]);
    } catch (error) {
      console.error("Detailed error:", error);
      setError("Error uploading readings: " + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  // Handler for reading changes
  const handleReadingChange = (meterId: string | number, reading: string) => {
    // Update the readingsState
    setReadingsState((prev) => {
      const newState = {
        ...prev,
        [meterId]: {
          ...prev[meterId],
          reading,
        },
      };

      // Save to localStorage immediately
      localStorage.setItem("readingsState", JSON.stringify(newState));

      return newState;
    });
  };

  // Handler for confirmation changes
  const handleConfirmationChange = (
    meterId: string | number,
    isConfirmed: boolean
  ): void => {
    setReadingsState((prev) => ({
      ...prev,
      [String(meterId)]: {
        ...prev[String(meterId)],
        isConfirmed,
      },
    }));
  };

  // Handler for route selection
  const handleRouteSelect = async (route: RouteData | null): Promise<void> => {
    console.log("Route selected:", route);
    setSelectedRoute(route);

    if (!route) {
      // Don't clear readingsState when unselecting route
      return;
    }

    // Check localStorage for existing readings for this route
    const existingReadings: ReadingsState = {};
    combinedMeters.forEach((meter) => {
      const reading = localStorage.getItem(`meter_${meter.ID}_reading`);
      const isConfirmed =
        localStorage.getItem(`meter_${meter.ID}_confirmed`) === "true";
      if (reading || isConfirmed) {
        existingReadings[meter.ID] = {
          reading: reading || "",
          isConfirmed: isConfirmed,
        };
      }
    });

    // Update readingsState with any existing readings
    if (Object.keys(existingReadings).length > 0) {
      setReadingsState(existingReadings);
    }
  };

  // Handler for viewing summary
  const onViewSummary = useCallback((): void => {
    const readingsToUpload = combinedMeters.map((meter) => ({
      ID: meter.ID,
      ADDRESS: meter.ADDRESS,
      ...meter.readings,
      currentReading: readingsState[meter.ID]?.reading || "---",
    }));

    // Generate email content
    const emailContent = generateEmailContent(combinedMeters, readingsState);

    setSubmittedReadings(readingsToUpload);
    setCurrentIndex(combinedMeters.length);
  }, [combinedMeters, readingsState]);

  // Handler for restarting the process
  const handleRestart = (): void => {
    // Clear readings state
    setReadingsState({});

    // Reset the last viewed meter index to 0
    setLastViewedMeterIndex(0);

    // Also make sure localStorage doesn't have this value
    localStorage.removeItem("lastViewedMeterIndex");

    // Other reset logic...
  };

  // Keep this separate useEffect for SAVING state
  useEffect(() => {
    // Only save state if user is logged in and we have meters
    if (user && selectedRoute && combinedMeters.length > 0) {
      const stateToSave = {
        currentIndex,
        selectedRoute,
        combinedMeters: combinedMeters.map((meter) => ({
          ID: meter.ID,
          ADDRESS: meter.ADDRESS,
        })),
      };

      localStorage.setItem("appState", JSON.stringify(stateToSave));
      console.log(`Saved app state: meter index ${currentIndex}`);
    }
  }, [currentIndex, selectedRoute, combinedMeters, user]);

  // Update the handleNavigationAttempt function in App.tsx
  const handleNavigationAttempt = useCallback(
    (navigationCallback: () => void) => {
      // If the child component is already handling navigation, respect that
      if (navigationHandledByChild) {
        // Just update the pending navigation without re-checking anything
        setPendingNavigation(() => navigationCallback);
        return;
      }

      // Check if we have a reading with value but not confirmed
      const hasUnconfirmedReading = Object.entries(readingsState).some(
        ([meterId, state]) => {
          const isCurrentMeter =
            currentIndex !== null &&
            currentIndex < combinedMeters.length &&
            combinedMeters[currentIndex].ID.toString() === meterId;

          return isCurrentMeter && state?.reading && !state?.isConfirmed;
        }
      );

      if (hasUnconfirmedReading) {
        // Tell the MeterScreen to handle this navigation
        setNavigationHandledByChild(true);
        setPendingNavigation(() => navigationCallback);
        return;
      }

      // No unconfirmed readings, execute immediately
      navigationCallback();
    },
    [readingsState, currentIndex, combinedMeters, navigationHandledByChild]
  );

  // Add a cleanup effect to ensure no stale state persists between renders
  useEffect(() => {
    return () => {
      // Cleanup function - runs when component unmounts
      setNavigationHandledByChild(false);
      setPendingNavigation(null);
    };
  }, []);

  // If authentication is still being checked, show nothing
  if (!isAuthStateReady) {
    return <div>Loading...</div>;
  }

  // If no user is logged in, show login screen
  if (!user) {
    return <LoginScreen />;
  }

  // Home screen (when currentIndex is null)
  if (currentIndex === null) {
    // Check for any readings or confirmed readings in readingsState
    const hasReadings = Object.values(readingsState).some(
      (state) => state?.reading || state?.isConfirmed
    );

    return (
      <BrowserRouter>
        <Routes>
          <Route
            path="/"
            element={
              <Layout
                showSidebar={false}
                meters={combinedMeters}
                currentIndex={-1}
                onSelectMeter={() => {}}
                onHomeClick={handleHomeClick}
                onFinishClick={handleUploadReadings}
                readingsState={readingsState}
                onNavigationAttempt={handleNavigationAttempt}
              >
                <HomeScreen
                  hasReadings={hasReadings}
                  onStart={handleStartClick}
                  onContinue={() => setCurrentIndex(lastViewedMeterIndex)}
                  onRestart={handleRestart}
                  routes={availableRoutes}
                  onRouteSelect={handleRouteSelect}
                  isLoading={isLoading}
                  error={error}
                  selectedRoute={selectedRoute}
                  onInitialize={() =>
                    initializeFirebaseData(auth, db, appCheckInitialized).then(
                      (result) => result.success
                    )
                  }
                  selectedMonth={selectedMonth}
                  selectedYear={selectedYear}
                  onDateChange={handleDateChange}
                  searchResults={[]}
                  combinedMeters={combinedMeters}
                  onMeterSelect={(index: number) => setCurrentIndex(index)}
                />
              </Layout>
            }
          />
          {/* Remove routes to non-existent components 
          <Route path="/email-preview" element={<EmailPreview />} />
          <Route path="/email-preview-table" element={<EmailPreviewTable />} />
          */}
        </Routes>
      </BrowserRouter>
    );
  }
  // Meter screens
  else if (currentIndex !== null && currentIndex < combinedMeters.length) {
    return (
      <Layout
        showSidebar={true}
        meters={combinedMeters}
        currentIndex={currentIndex}
        onSelectMeter={(i: number) =>
          handleNavigationAttempt(() => setCurrentIndex(i))
        }
        onHomeClick={() => handleNavigationAttempt(handleHomeClick)}
        onFinishClick={() => handleNavigationAttempt(handleGoToSummary)}
        readingsState={readingsState}
        onNavigationAttempt={handleNavigationAttempt}
      >
        <MeterScreen
          meter={combinedMeters[currentIndex]}
          currentIndex={currentIndex}
          totalMeters={combinedMeters.length}
          onHome={handleHomeClick}
          onPrev={handlePreviousMeter}
          onNext={handleNextMeter}
          onFinish={handleGoToSummary}
          onReadingChange={handleReadingChange}
          onConfirmationChange={handleConfirmationChange}
          pendingNavigation={pendingNavigation}
          setPendingNavigation={setPendingNavigation}
          setNavigationHandledByChild={setNavigationHandledByChild}
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
          routeId={selectedRoute?.id || null}
          onUpdateReadings={() => {}}
        />
      </Layout>
    );
  }
  // Final check screen after readings are submitted
  else if (currentIndex === combinedMeters.length) {
    if (submittedReadings.length > 0) {
      return (
        <Layout
          showSidebar={false}
          meters={combinedMeters}
          currentIndex={currentIndex}
          onSelectMeter={(i: number) =>
            handleNavigationAttempt(() => setCurrentIndex(i))
          }
          onHomeClick={() => handleNavigationAttempt(handleHomeClick)}
          onFinishClick={handleGoToSummary}
          readingsState={readingsState}
          onNavigationAttempt={handleNavigationAttempt}
        >
          <FinalCheckScreen
            readingsState={readingsState}
            meters={combinedMeters}
            onContinue={() => {
              // Find first pending meter
              const nextIndex = findFirstPendingMeter(
                combinedMeters,
                readingsState
              );
              setCurrentIndex(nextIndex);
            }}
            onViewSummary={onViewSummary}
            onFinish={() => {
              // Clear all state and go home
              setReadingsState({});
              setCurrentIndex(null);
              setSubmittedReadings([]);
              localStorage.clear(); // Clear all stored readings
            }}
          />
        </Layout>
      );
    }

    // Summary screen if readings haven't been submitted
    return (
      <Layout
        meters={combinedMeters}
        currentIndex={currentIndex}
        onSelectMeter={(i: number) => setCurrentIndex(i)}
        onHomeClick={handleHomeClick}
        onFinishClick={handleUploadReadings}
        showSidebar={false}
        readingsState={readingsState}
        onNavigationAttempt={handleNavigationAttempt}
      >
        <SummaryScreen
          meters={combinedMeters}
          readingsState={readingsState}
          setReadingsState={setReadingsState}
          onBack={() => setCurrentIndex(currentIndex - 1)}
          onFinalize={handleUploadReadings}
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
          onSelectMeter={(index: number) => setCurrentIndex(index)}
        />
      </Layout>
    );
  }
  // Summary screen
  else if (currentIndex === combinedMeters.length + 1) {
    return (
      <Layout
        showSidebar={false}
        meters={combinedMeters}
        currentIndex={currentIndex}
        onSelectMeter={(i: number) => setCurrentIndex(i)}
        onHomeClick={handleHomeClick}
        onFinishClick={handleUploadReadings}
        readingsState={readingsState}
        onNavigationAttempt={handleNavigationAttempt}
      >
        <SummaryScreen
          meters={combinedMeters}
          readingsState={readingsState}
          onFinalize={handleUploadReadings}
          onBack={() => setCurrentIndex(combinedMeters.length - 1)}
          onSelectMeter={(i: number) => setCurrentIndex(i)}
        />
      </Layout>
    );
  }
  // Invalid state
  else {
    return <div>Estado Inválido</div>;
  }
}

// Also add a function to clear the saved state when logging out
const handleLogout = async () => {
  try {
    await signOut(auth);
    // Clear saved state
    localStorage.removeItem("appState");
    console.log("Cleared saved app state on logout");
  } catch (error) {
    console.error("Error signing out:", error);
  }
};

export default App;

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
import { Box, CircularProgress, Typography } from "@mui/material";

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
  getPreviousReadings,
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

  // First, update the state definitions with a more explicit loading state
  const [appState, setAppState] = useState<
    "loading" | "ready" | "auth-required"
  >("loading");
  const [isRestoringSession, setIsRestoringSession] = useState<boolean>(true);

  // Add this new state to store previous readings data
  const [previousReadingsData, setPreviousReadingsData] = useState<{
    [meterId: string]: any;
  }>({});

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
      const reading = localStorage.getItem(`meter_${String(meter.ID)}_reading`);
      const isConfirmed =
        localStorage.getItem(`meter_${String(meter.ID)}_confirmed`) === "true";
      if (reading || isConfirmed) {
        initialState[String(meter.ID)] = {
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

  // First, add a sessionKey to make stored data specific to the current user
  const getSessionKey = () => {
    return user?.uid ? `appState_${user.uid}` : "appState";
  };

  // Add this near where other useEffect hooks are defined
  useEffect(() => {
    // This effect handles restoring the session from localStorage
    const restoreSession = async () => {
      // Only attempt restoration when user is logged in
      if (!user) return;

      try {
        console.log("Checking for saved session data...");
        const sessionKey = getSessionKey();
        const savedData = localStorage.getItem(sessionKey);

        if (!savedData) {
          console.log("No saved session data found");
          setAppState("ready");
          return;
        }

        const session = JSON.parse(savedData);
        console.log("Found saved session:", session);

        // We need to wait for routes to be available before restoring
        if (availableRoutes.length === 0) {
          console.log("Waiting for routes to load before restoring session...");
          return; // Exit and wait for routes to load - this effect will run again
        }

        // Find matching route
        if (session.selectedRoute) {
          const matchingRoute = availableRoutes.find(
            (route) => route.id === session.selectedRoute.id
          );

          if (matchingRoute) {
            console.log("Found matching route, selecting:", matchingRoute.id);

            // First select the route - this is async
            await handleRouteSelect(matchingRoute);

            // After route is selected, restore the meter index
            if (
              session.currentIndex !== null &&
              session.currentIndex !== undefined
            ) {
              console.log(`Restoring meter index: ${session.currentIndex}`);
              setCurrentIndex(session.currentIndex);
            }
          }
        }

        // Mark restoration as complete
        setAppState("ready");
        console.log("Session restoration complete");
      } catch (error) {
        console.error("Error restoring session:", error);
        setAppState("ready");
      }
    };

    // Only run this when app is in loading state
    if (appState === "loading" && availableRoutes.length > 0) {
      restoreSession();
    }

    // Add a safety timeout to prevent getting stuck in loading
    const safetyTimeout = setTimeout(() => {
      if (appState === "loading") {
        console.log("Safety timeout triggered - moving to ready state");
        setAppState("ready");
      }
    }, 3000);

    return () => clearTimeout(safetyTimeout);
  }, [user, appState, availableRoutes]);

  // Update the saveSession logic
  useEffect(() => {
    // Only save state if user is logged in and app is ready
    if (user && appState === "ready") {
      const stateToSave = {
        currentIndex,
        selectedRoute,
        timestamp: new Date().getTime(),
      };

      const sessionKey = getSessionKey();
      localStorage.setItem(sessionKey, JSON.stringify(stateToSave));
      console.log(
        `Saved session state: route=${selectedRoute?.id}, index=${currentIndex}`
      );
    }
  }, [currentIndex, selectedRoute, user, appState]);

  // Update auth effect to set loading state when user logs in
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setIsAuthStateReady(true);

      if (user) {
        // User is logged in
        setUser(user);
        // Start in loading state to allow restoration
        setAppState("loading");
      } else {
        // User is logged out
        setUser(null);
        setCurrentIndex(null);
        setAppState("auth-required");
      }
    });

    return () => unsubscribe();
  }, []);

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
          currentReading: readingsState[String(meter.ID)]?.reading || "---",
          ID: String(meter.ID),
        };
      });

      const uploadedReadings = await initializeFirebaseData(
        auth,
        db,
        appCheckInitialized
      );

      // Clear all readings from localStorage
      combinedMeters.forEach((meter) => {
        const readingKey = `meter_${String(meter.ID)}_reading`;
        const confirmedKey = `meter_${String(meter.ID)}_confirmed`;
        const verificationKey = `meter_${String(meter.ID)}_verification`;

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
  const handleReadingChange = (meterId: string, reading: string) => {
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
  const handleConfirmationChange = (meterId: string, isConfirmed: boolean) => {
    setReadingsState((prev) => ({
      ...prev,
      [meterId]: {
        ...prev[meterId],
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
      const reading = localStorage.getItem(`meter_${String(meter.ID)}_reading`);
      const isConfirmed =
        localStorage.getItem(`meter_${String(meter.ID)}_confirmed`) === "true";
      if (reading || isConfirmed) {
        existingReadings[String(meter.ID)] = {
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

  // Add this handler to be called from MeterScreen when readings are fetched
  const handlePreviousReadingsUpdate = (meterId: string, readings: any) => {
    setPreviousReadingsData((prev) => ({
      ...prev,
      [meterId]: readings,
    }));
    console.log(`Updated previous readings for meter ${meterId}:`, readings);
  };

  // Then update the onViewSummary function to use this data
  const onViewSummary = useCallback((): void => {
    // Use the previousReadingsData state to get previous readings
    const readingsToUpload = combinedMeters.map((meter) => {
      const meterId = String(meter.ID);
      const currentReading = readingsState[meterId]?.reading || "---";
      const isConfirmed = readingsState[meterId]?.isConfirmed || false;

      // Get the previous reading from our stored data
      const meterReadings = previousReadingsData[meterId];
      let previousReading = "---";
      let consumption = "---";

      if (
        meterReadings &&
        meterReadings.entries &&
        meterReadings.entries.length > 0
      ) {
        // Use the first entry (most recent) as the previous reading
        previousReading = meterReadings.entries[0].value;

        // Calculate consumption
        if (currentReading !== "---" && previousReading !== "---") {
          try {
            const current = parseFloat(currentReading);
            const previous = parseFloat(String(previousReading));
            if (!isNaN(current) && !isNaN(previous)) {
              consumption = (current - previous).toFixed(1);
            }
          } catch (e) {
            console.error("Error calculating consumption:", e);
          }
        }
      }

      console.log(`Meter ${meter.ID} summary data:`, {
        ID: meter.ID,
        ADDRESS: meter.ADDRESS,
        previousReading,
        currentReading,
        consumption,
        isConfirmed,
      });

      return {
        ...meter,
        previousReading,
        currentReading,
        consumption,
        isConfirmed,
      };
    });

    console.log("Prepared data for summary:", readingsToUpload);

    // Set the data for the summary screen
    setSubmittedReadings(readingsToUpload);

    // Navigate to the summary screen
    setCurrentIndex(combinedMeters.length + 1);
  }, [combinedMeters, readingsState, previousReadingsData]);

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
            String(combinedMeters[currentIndex].ID) === meterId;

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

  // Add these handler functions
  const handleContinue = () => {
    setCurrentIndex(findFirstPendingMeter(combinedMeters, readingsState));
  };

  const handleFinish = () => {
    setCurrentIndex(combinedMeters.length + 1);
  };

  // Now completely replace the render logic
  if (appState === "loading") {
    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
        }}
      >
        <CircularProgress />
        <Typography sx={{ mt: 2 }}>
          {!isAuthStateReady
            ? "Verificando sesión..."
            : "Restaurando estado anterior..."}
        </Typography>
      </Box>
    );
  }

  if (appState === "auth-required") {
    return <LoginScreen />;
  }

  // Only render the app content when we're absolutely sure the state is ready
  return (
    <BrowserRouter>
      {(() => {
        // Home screen (when currentIndex is null and we're NOT restoring)
        if (currentIndex === null) {
          // Check for any readings or confirmed readings in readingsState
          const hasReadings = Object.values(readingsState).some(
            (state) => state?.reading || state?.isConfirmed
          );

          return (
            <Routes>
              <Route
                path="/"
                element={
                  <HomeScreen
                    hasReadings={hasReadings}
                    onStart={async () => {
                      if (selectedRoute) {
                        // Find the first meter that doesn't have a confirmed reading
                        const firstPendingIndex = findFirstPendingMeter(
                          combinedMeters,
                          readingsState
                        );
                        setCurrentIndex(
                          firstPendingIndex !== -1 ? firstPendingIndex : 0
                        );
                      }
                    }}
                    onContinue={() => {
                      // If there are some readings, find the first pending one
                      const firstPendingIndex = findFirstPendingMeter(
                        combinedMeters,
                        readingsState
                      );
                      if (firstPendingIndex !== -1) {
                        setCurrentIndex(firstPendingIndex);
                      } else {
                        // If all confirmed, go to summary
                        setCurrentIndex(combinedMeters.length);
                      }
                    }}
                    routes={availableRoutes}
                    onRouteSelect={handleRouteSelect}
                    onRestart={handleRestart}
                    isLoading={isLoading}
                    error={error}
                    selectedRoute={selectedRoute}
                    onInitialize={async () => {
                      const result = await initializeFirebaseData(
                        auth,
                        db,
                        appCheckInitialized
                      );
                      return result.success;
                    }}
                    selectedMonth={selectedMonth}
                    selectedYear={selectedYear}
                    onDateChange={(month, year) => {
                      setSelectedMonth(month);
                      setSelectedYear(year);
                    }}
                    onMeterSelect={(index: number) => setCurrentIndex(index)}
                    combinedMeters={combinedMeters}
                  />
                }
              />
            </Routes>
          );
        }
        // Show MeterScreen (when currentIndex is not null and within range)
        else if (
          currentIndex !== null &&
          currentIndex < combinedMeters.length
        ) {
          const currentMeter = combinedMeters[currentIndex];
          return (
            <Layout
              showSidebar={true}
              meters={combinedMeters}
              currentIndex={currentIndex}
              onSelectMeter={(index: number) => setCurrentIndex(index)}
              onHomeClick={handleHomeClick}
              onFinishClick={() => {
                // First go to the summary screen
                onViewSummary(); // This prepares the data for the summary
                setCurrentIndex(combinedMeters.length + 1); // This navigates to the SummaryScreen
              }}
              readingsState={readingsState}
              onNavigationAttempt={handleNavigationAttempt}
            >
              <MeterScreen
                meter={currentMeter}
                currentIndex={currentIndex}
                totalMeters={combinedMeters.length}
                onHome={handleHomeClick}
                onPrev={handlePreviousMeter}
                onNext={handleNextMeter}
                onFinish={() => {
                  // First go to the summary screen
                  onViewSummary(); // This prepares the data for the summary
                  setCurrentIndex(combinedMeters.length + 1); // This navigates to the SummaryScreen
                }}
                onReadingChange={(meterId, reading) =>
                  handleReadingChange(String(currentMeter.ID), reading)
                }
                onConfirmationChange={(meterId, isConfirmed) =>
                  handleConfirmationChange(String(currentMeter.ID), isConfirmed)
                }
                pendingNavigation={pendingNavigation}
                setPendingNavigation={setPendingNavigation}
                setNavigationHandledByChild={setNavigationHandledByChild}
                reading={readingsState[String(currentMeter.ID)]?.reading || ""}
                isConfirmed={
                  readingsState[String(currentMeter.ID)]?.isConfirmed || false
                }
                selectedMonth={selectedMonth}
                selectedYear={selectedYear}
                routeId={selectedRoute?.id || ""}
                onUpdateReadings={(updatedReadings) => {
                  console.log("Updated readings:", updatedReadings);
                }}
                onPreviousReadingsUpdate={handlePreviousReadingsUpdate}
              />
            </Layout>
          );
        }
        // Final check screen (after summary)
        else if (currentIndex === combinedMeters.length) {
          return (
            <Layout
              showSidebar={true}
              meters={combinedMeters}
              currentIndex={currentIndex}
              onSelectMeter={(index: number) => setCurrentIndex(index)}
              onHomeClick={handleHomeClick}
              onFinishClick={() => setCurrentIndex(combinedMeters.length + 1)}
              readingsState={readingsState}
              onNavigationAttempt={handleNavigationAttempt}
            >
              <FinalCheckScreen
                meters={combinedMeters}
                readingsState={readingsState}
                onBack={() => setCurrentIndex(combinedMeters.length + 1)}
                onGoToSummary={() => setCurrentIndex(combinedMeters.length + 1)}
                onSelectMeter={(index: number) => setCurrentIndex(index)}
                onContinue={handleContinue}
                onViewSummary={onViewSummary}
                onFinish={handleFinish}
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
              onSelectMeter={(index: number) => setCurrentIndex(index)}
              onHomeClick={handleHomeClick}
              onFinishClick={handleUploadReadings}
              readingsState={readingsState}
              onNavigationAttempt={handleNavigationAttempt}
            >
              <SummaryScreen
                meters={submittedReadings}
                readingsState={readingsState}
                onFinalize={handleUploadReadings}
                onBack={() => setCurrentIndex(combinedMeters.length - 1)}
                onSelectMeter={(index: number) => setCurrentIndex(index)}
              />
            </Layout>
          );
        }
        // Invalid state
        else {
          return <div>Estado Inválido</div>;
        }
      })()}
    </BrowserRouter>
  );
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

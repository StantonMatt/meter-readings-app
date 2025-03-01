// App.tsx
import { useState, useCallback, useEffect, useMemo } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { collection, getDocs, doc, getDoc, setDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { Box, CircularProgress, Typography } from "@mui/material";

// Components
import Layout from "./Layout";
import HomeScreen from "./HomeScreen";
import MeterScreen from "./MeterScreen";
import FinalCheckScreen from "./FinalCheckScreen";
import SummaryScreen from "./SummaryScreen";
import LoginScreen from "./LoginScreen";

// Data and Config
import routeData from "./data/routes/sl-pp/ruta_sl-pp.json";
import { db, auth, functions, appCheckInitialized } from "./firebase-config";

// Utilities
import { months } from "./utils/dateUtils";
import {
  calculateMonthlyConsumption,
  findFirstPendingMeter,
  MeterData,
  ReadingsState,
  getMeterReading,
} from "./utils/readingUtils";
import { generateEmailContent } from "./utils/emailUtils";
import { initializeFirebaseData } from "./services/firebaseService";

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

// Near the top of the file, add this type definition
type AppState = "loading" | "ready" | "auth-required";

function App(): JSX.Element {
  // Core state
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const [submittedReadings, setSubmittedReadings] = useState<any[]>([]);
  const [availableRoutes, setAvailableRoutes] = useState<RouteData[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<RouteData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [readingsData, setReadingsData] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
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
  const [appState, setAppState] = useState<AppState>("loading");
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

  // Handler for uploading readings
  const handleUploadReadings = async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      // Upload readings to Firebase
      const readingsToUpload = combinedMeters.map((meter) => {
        const meterData = getMeterReading(meter.ID);
        const reading = readingsState[String(meter.ID)];
        const currentReading = reading?.reading || "---";
        const previousReading = meterData?.previousReading || "---";
        const consumption = meterData?.consumption || null;
        const verification = meterData?.verification || null;

        // Calculate consumption value if we have valid readings
        let consumptionValue = 0;
        if (currentReading !== "---" && previousReading !== "---") {
          const current = parseFloat(currentReading);
          const previous = parseFloat(previousReading);
          if (!isNaN(current) && !isNaN(previous)) {
            consumptionValue = current - previous;
          }
        }

        return {
          ADDRESS: meter.ADDRESS,
          ID: String(meter.ID),
          Reading: currentReading,
          previousReading,
          currentReading,
          consumption: consumptionValue,
          verification: verification
            ? {
                ...verification,
                consumption: consumptionValue,
                currentReading,
                previousReading,
                average: meter.averageConsumption,
                percentageAboveAverage:
                  consumptionValue && meter.averageConsumption
                    ? ((consumptionValue - meter.averageConsumption) /
                        meter.averageConsumption) *
                      100
                    : 0,
              }
            : null,
        };
      });

      // Calculate consumption statistics from the actual readings
      const validReadings = readingsToUpload.filter((reading) => {
        return (
          reading.consumption !== 0 &&
          reading.verification !== null &&
          !isNaN(reading.consumption) &&
          reading.currentReading !== "---" &&
          reading.previousReading !== "---"
        );
      });

      console.log("Valid readings for statistics:", validReadings);

      const consumptionValues = validReadings
        .map((r) => r.consumption)
        .filter((c) => !isNaN(c) && c !== null);

      console.log("Consumption values:", consumptionValues);

      const totalConsumption = consumptionValues.reduce(
        (sum, val) => sum + val,
        0
      );
      const avgConsumption =
        consumptionValues.length > 0
          ? totalConsumption / consumptionValues.length
          : 0;
      const maxConsumption =
        consumptionValues.length > 0 ? Math.max(...consumptionValues) : 0;
      const minConsumption =
        consumptionValues.length > 0 ? Math.min(...consumptionValues) : 0;

      console.log("Calculated statistics:", {
        totalConsumption,
        avgConsumption,
        maxConsumption,
        minConsumption,
      });

      // Generate email content
      const emailContent = generateEmailContent(combinedMeters, readingsState);

      // Call the Firebase function to send email with updated statistics
      const sendReadingsMail = httpsCallable(functions, "sendReadingsMail");
      await sendReadingsMail({
        readings: readingsToUpload,
        emailContent,
        month: months[selectedMonth],
        year: selectedYear,
        routeId: selectedRoute?.id || "unknown",
        statistics: {
          totalConsumption: Math.round(totalConsumption * 10) / 10,
          avgConsumption: Math.round(avgConsumption * 10) / 10,
          maxConsumption: Math.round(maxConsumption * 10) / 10,
          minConsumption: Math.round(minConsumption * 10) / 10,
          totalMeters: combinedMeters.length,
          completedMeters: validReadings.length,
          skippedMeters: combinedMeters.length - validReadings.length,
        },
      });

      const uploadedReadings = await initializeFirebaseData(
        auth,
        db,
        appCheckInitialized
      );

      // Set current index to final screen
      setCurrentIndex(combinedMeters.length);

      // Store the uploaded readings for reference
      setSubmittedReadings([uploadedReadings]);

      // Only clear the readings state and localStorage when navigating away from the summary screen
      const clearReadingsData = () => {
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
      };

      // Add event listener to clear data when user navigates away
      window.addEventListener("beforeunload", clearReadingsData, {
        once: true,
      });
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

  if (appState === ("auth-required" as AppState)) {
    return <LoginScreen />;
  }

  // Only render the app content when we're absolutely sure the state is ready
  return (
    <BrowserRouter
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      {(() => {
        // Show login screen when auth is required
        if (appState === ("auth-required" as AppState)) {
          return (
            <Routes>
              <Route path="*" element={<LoginScreen />} />
            </Routes>
          );
        }

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
                _reading={readingsState[String(currentMeter.ID)]?.reading || ""}
                _isConfirmed={
                  readingsState[String(currentMeter.ID)]?.isConfirmed || false
                }
                selectedMonth={selectedMonth}
                selectedYear={selectedYear}
                routeId={selectedRoute?.id || ""}
                onPreviousReadingsUpdate={handlePreviousReadingsUpdate}
                readingsState={readingsState}
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

export default App;

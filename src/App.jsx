// App.jsx
import React, { useState, useCallback, useEffect, useMemo } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, doc, setDoc, getDoc, query, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";

// Components
import Layout from "./Layout";
import HomeScreen from "./HomeScreen";
import MeterScreen from "./MeterScreen";
import FinalCheckScreen from "./FinalCheckScreen";
import SummaryScreen from "./SummaryScreen";
import LoginScreen from "./LoginScreen";
import EmailPreview from "./EmailPreview";
import EmailPreviewTable from './EmailPreviewTable';
import RestartConfirmationDialog from './components/RestartConfirmationDialog';

// Data and Config
import routeData from "./data/routes/San_Lorenzo-Portal_Primavera.json";
import { db, storage, auth, functions, appCheck, appCheckInitialized } from "./firebase-config";

// Utilities
import { months, getPreviousMonthYear } from "./utils/dateUtils";
import { calculateMonthlyConsumption, findFirstPendingMeter, generateCSV } from "./utils/readingUtils";
import { generateEmailContent } from "./utils/emailUtils";
import { createNavigationHandlers } from "./utils/navigationUtils";
import { loadPreviousReadings, initializeRouteData, uploadReadings } from "./services/firebaseService";

function App() {
  // Core state
  const [currentIndex, setCurrentIndex] = useState(null);
  const [submittedReadings, setSubmittedReadings] = useState([]);
  const [availableRoutes, setAvailableRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [previousReadings, setPreviousReadings] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [readingsData, setReadingsData] = useState([]);
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  // UI state
  const [restartDialogOpen, setRestartDialogOpen] = useState(false);
  const [restartConfirmation, setRestartConfirmation] = useState("");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState(null);
  
  // Date selection state
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const currentDate = new Date();
    return currentDate.getMonth();
  });

  const [selectedYear, setSelectedYear] = useState(() => {
    const currentDate = new Date();
    return currentDate.getFullYear();
  });

  // Calculate combined meters data
  const combinedMeters = useMemo(() => {
    return routeData.map((meter) => {
      const matchingReading = readingsData.find((r) => r.ID === meter.ID);
      if (matchingReading) {
        const {
          monthlyConsumption,
          averageConsumption,
          estimatedReading,
          monthsEstimated,
        } = calculateMonthlyConsumption(matchingReading);
        return {
          ...meter,
          readings: matchingReading,
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
    });
  }, [readingsData]);

  // Initialize readings state from localStorage
  const [readingsState, setReadingsState] = useState(() => {
    const initialState = {};
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

  // Create navigation handlers
  const { 
    handleSelectMeter, 
    handleHomeClick, 
    handleGoToSummary,
    handlePreviousMeter,
    handleNextMeter
  } = useMemo(() => {
    return createNavigationHandlers(
      currentIndex,
      combinedMeters,
      readingsState,
      setCurrentIndex,
      setShowConfirmDialog,
      setPendingNavigation
    );
  }, [currentIndex, combinedMeters, readingsState]);

  // Authentication effect
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setAuthChecked(true);
    });

    return () => unsubscribe();
  }, []);

  // Load routes effect
  useEffect(() => {
    let isMounted = true;

    const loadRoutes = async () => {
      if (!isMounted || !user) return;

      setIsLoading(true);
      try {
        console.log("Starting route load process...");
        console.log("Current user:", user.uid);

        // Wait for App Check initialization
        const isInitialized = await appCheckInitialized;
        console.log("App Check initialization status:", isInitialized);

        if (!isInitialized) {
          throw new Error("App Check initialization failed");
        }

        // First, try to initialize the route
        try {
          console.log("Attempting to initialize route data...");
          await initializeRouteData(auth, db, routeData, months, appCheckInitialized);
          console.log("Route initialization completed");
        } catch (error) {
          console.error("Route initialization failed:", error);
        }

        // Now try to fetch all routes
        console.log("Fetching all routes...");
        const routesRef = collection(db, "routes");
        const routesSnapshot = await getDocs(routesRef);

        console.log("Routes query completed, empty?", routesSnapshot.empty);
        console.log("Number of routes found:", routesSnapshot.size);

        if (!routesSnapshot.empty) {
          const routes = routesSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          console.log("Routes loaded:", routes);
          setAvailableRoutes(routes);
        } else {
          console.log("No routes found in Firestore");
          setAvailableRoutes([]);
        }
      } catch (error) {
        console.error("Load routes error details:", {
          code: error.code,
          message: error.message,
          details: error.details,
        });
        if (!isMounted) return;
        setError(error.message);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadRoutes();

    return () => {
      isMounted = false;
    };
  }, [user]);

  // Setup admin effect
  useEffect(() => {
    const setupAdmin = async () => {
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
        console.log("Note: Admin setup skipped -", error.message);
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
  const handleDateChange = (month, year) => {
    setSelectedMonth(month);
    setSelectedYear(year);
  };

  // Handler for starting the readings process
  const handleStartClick = async () => {
    try {
      setIsLoading(true);

      // Load all 5 months of readings
      const readings = await loadPreviousReadings(
        routeData, 
        selectedYear, 
        selectedMonth,
        db,
        months
      );
      setReadingsData(readings);

      // Update state
      setPreviousReadings(readings);
      setCurrentIndex(0);
    } catch (error) {
      console.error("Error in handleStartClick:", error);
      setError("Failed to load route data. Using local data.");
      setCurrentIndex(0);
    } finally {
      setIsLoading(false);
    }
  };

  // Handler for uploading readings
  const handleUploadReadings = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Upload readings to Firebase
      const uploadedReadings = await uploadReadings(
        combinedMeters,
        readingsState,
        selectedRoute,
        selectedMonth,
        selectedYear,
        db,
        functions,
        months,
        appCheckInitialized,
        auth
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
      setSubmittedReadings(uploadedReadings);
    } catch (error) {
      console.error("Detailed error:", error);
      setError("Error uploading readings: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Handler for reading changes
  const handleReadingChange = useCallback((meterId, reading) => {
    setReadingsState((prev) => ({
      ...prev,
      [meterId]: { ...prev[meterId], reading },
    }));
  }, []);

  // Handler for confirmation changes
  const handleConfirmationChange = useCallback((meterId, isConfirmed) => {
    setReadingsState((prev) => ({
      ...prev,
      [meterId]: { ...prev[meterId], isConfirmed },
    }));
  }, []);

  // Handler for route selection
  const handleRouteSelect = async (route) => {
    console.log("Route selected:", route);
    setSelectedRoute(route);

    if (!route) {
      // Don't clear readingsState when unselecting route
      return;
    }

    // Check localStorage for existing readings for this route
    const existingReadings = {};
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
  const onViewSummary = useCallback(() => {
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
  const handleRestart = () => {
    setRestartDialogOpen(true);
  };

  // Handler for confirming restart
  const confirmRestart = () => {
    // Clear all readings from localStorage
    combinedMeters.forEach((meter) => {
      localStorage.removeItem(`meter_${meter.ID}_reading`);
      localStorage.removeItem(`meter_${meter.ID}_confirmed`);
      localStorage.removeItem(`meter_${meter.ID}_verification`);
    });
    // Reset readings state
    setReadingsState({});
    setRestartDialogOpen(false);
    setRestartConfirmation("");
  };

  // If authentication is still being checked, show nothing
  if (!authChecked) {
    return null;
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
              >
                <HomeScreen
                  hasReadings={hasReadings}
                  onStart={handleStartClick}
                  onContinue={() => setCurrentIndex(0)}
                  onRestart={handleRestart}
                  routes={availableRoutes}
                  onRouteSelect={handleRouteSelect}
                  isLoading={isLoading}
                  error={error}
                  selectedRoute={selectedRoute}
                  onInitialize={() => initializeRouteData(auth, db, routeData, months, appCheckInitialized)}
                  selectedMonth={selectedMonth}
                  selectedYear={selectedYear}
                  onDateChange={handleDateChange}
                  searchResults={[]}
                  combinedMeters={combinedMeters}
                  onMeterSelect={handleSelectMeter}
                />
              </Layout>
            }
          />
          <Route
            path="/email-preview"
            element={<EmailPreview />}
          />
          <Route
            path="/email-preview-table"
            element={<EmailPreviewTable />}
          />
        </Routes>
        <RestartConfirmationDialog
          open={restartDialogOpen}
          onClose={() => {
            setRestartDialogOpen(false);
            setRestartConfirmation("");
          }}
          confirmationText={restartConfirmation}
          onConfirmationChange={setRestartConfirmation}
          onConfirm={confirmRestart}
        />
      </BrowserRouter>
    );
  } 
  // Meter screens
  else if (currentIndex >= 0 && currentIndex < combinedMeters.length) {
    return (
      <Layout
        showSidebar={true}
        meters={combinedMeters}
        currentIndex={currentIndex}
        onSelectMeter={handleSelectMeter}
        onHomeClick={handleHomeClick}
        onFinishClick={handleGoToSummary}
        readingsState={readingsState}
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
          showConfirmDialog={showConfirmDialog}
          setShowConfirmDialog={setShowConfirmDialog}
          pendingNavigation={pendingNavigation}
          setPendingNavigation={setPendingNavigation}
        />
      </Layout>
    );
  } 
  // Final check screen after readings are submitted
  else if (currentIndex === combinedMeters.length) {
    if (submittedReadings.length > 0) {
      return (
        <Layout
          meters={combinedMeters}
          currentIndex={currentIndex}
          onSelectMeter={handleSelectMeter}
          onHomeClick={handleHomeClick}
          onFinishClick={handleUploadReadings}
          showSidebar={false}
          readingsState={readingsState}
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
        onSelectMeter={handleSelectMeter}
        onHomeClick={handleHomeClick}
        onFinishClick={handleUploadReadings}
        showSidebar={false}
        readingsState={readingsState}
      >
        <SummaryScreen
          meters={combinedMeters}
          readingsState={readingsState}
          setReadingsState={setReadingsState}
          onBack={() => setCurrentIndex(currentIndex - 1)}
          onFinalize={handleUploadReadings}
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
          onSelectMeter={(index) => setCurrentIndex(index)}
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
        onSelectMeter={(i) => setCurrentIndex(i)}
        onHomeClick={handleHomeClick}
        onFinishClick={handleUploadReadings}
        readingsState={readingsState}
      >
        <SummaryScreen
          meters={combinedMeters}
          readingsState={readingsState}
          onFinalize={handleUploadReadings}
          onBack={() => setCurrentIndex(combinedMeters.length - 1)}
          onSelectMeter={(i) => setCurrentIndex(i)}
        />
      </Layout>
    );
  } 
  // Invalid state
  else {
    return <div>Estado Inválido</div>;
  }
}

export default App;
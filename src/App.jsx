// App.jsx
import React, { useState, useCallback, useEffect, useMemo } from "react";
import Layout from "./Layout";
import HomeScreen from "./HomeScreen";
import MeterScreen from "./MeterScreen";
import FinalCheckScreen from "./FinalCheckScreen";
import SummaryScreen from "./SummaryScreen";
import routeData from "./data/routes/San_Lorenzo-Portal_Primavera.json";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
} from "@mui/material";
import { db, storage, auth, functions } from "./firebase-config";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  getDoc,
  query,
  where,
  orderBy,
  limit,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { httpsCallable } from "firebase/functions";

const months = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

// Add this month mapping near the top of App.jsx
const monthAbbreviations = {
  Enero: "Ene",
  Febrero: "Feb",
  Marzo: "Mar",
  Abril: "Abr",
  Mayo: "May",
  Junio: "Jun",
  Julio: "Jul",
  Agosto: "Ago",
  Septiembre: "Sep",
  Octubre: "Oct",
  Noviembre: "Nov",
  Diciembre: "Dic",
};

// Update the calculateMonthlyConsumption function
const calculateMonthlyConsumption = (readings) => {
  const months = Object.keys(readings)
    .filter((key) => key !== "ID")
    .sort(); // Sort chronologically

  const consumption = [];

  for (let i = 1; i < months.length; i++) {
    const currentReading = readings[months[i]];
    const previousReading = readings[months[i - 1]];

    // Only calculate consumption if both readings are valid numbers
    if (
      currentReading !== "---" &&
      previousReading !== "---" &&
      currentReading !== "NO DATA" &&
      previousReading !== "NO DATA" &&
      !isNaN(currentReading) &&
      !isNaN(previousReading)
    ) {
      const monthlyUsage = currentReading - previousReading;
      consumption.push(monthlyUsage);
    } else {
      // Push null or some indicator for missing data
      consumption.push(null);
    }
  }

  // Only use the last 5 months of valid consumption (or less if not available)
  const recentConsumption = consumption.slice(-5);
  const validReadings = recentConsumption.filter(
    (reading) => reading !== null && !isNaN(reading)
  );

  const average =
    validReadings.length > 0
      ? validReadings.reduce((a, b) => a + b, 0) / validReadings.length
      : 0;

  return {
    monthlyConsumption: consumption,
    averageConsumption: Math.round(average * 100) / 100, // Round to 2 decimal places
  };
};

// Add this utility function to get formatted month-year string
const getFormattedMonthYear = (date) => {
  const year = date.getFullYear();
  const month = months[date.getMonth()].substring(0, 3).toLowerCase();
  return `${year}-${month}`;
};

// Update the orderReadingsByDate function
const orderReadingsByDate = (readings) => {
  return Object.entries(readings)
    .filter(([key]) => key !== "ID")
    .sort((a, b) => {
      // Parse dates like "2025-Enero" into comparable values
      const [yearA, monthA] = a[0].split("-");
      const [yearB, monthB] = b[0].split("-");

      // First compare years
      if (yearA !== yearB) {
        return yearA - yearB;
      }

      // If years are the same, compare months
      const months = {
        Enero: 0,
        Febrero: 1,
        Marzo: 2,
        Abril: 3,
        Mayo: 4,
        Junio: 5,
        Julio: 6,
        Agosto: 7,
        Septiembre: 8,
        Octubre: 9,
        Noviembre: 10,
        Diciembre: 11,
      };

      return months[monthA] - months[monthB];
    })
    .reduce(
      (acc, [key, value]) => {
        acc[key] = value;
        return acc;
      },
      { ID: readings.ID }
    );
};

// Add this utility function to get the previous month and year
const getPreviousMonthYear = (year, month) => {
  if (month === 0) {
    // If January
    return { year: year - 1, month: 11 }; // Go to December of previous year
  }
  return { year, month: month - 1 };
};

// Add this function to get the file name for a given month and year
const getMonthFileName = (year, month) => {
  const monthName = months[month];
  return `${year}-${monthName}`;
};

// Add this utility function to get all monthly readings
const getAllMonthlyReadings = async () => {
  const files = [
    "2024-Septiembre",
    "2024-Octubre",
    "2024-Noviembre",
    "2024-Diciembre",
    "2025-Enero",
  ];

  const readings = {};

  for (const fileName of files) {
    try {
      const monthlyData = (await import(`./data/readings/${fileName}.json`))
        .default;
      readings[fileName] = monthlyData;
    } catch (error) {
      console.error(`Failed to load ${fileName}.json:`, error);
    }
  }

  return readings;
};

function App() {
  const [currentIndex, setCurrentIndex] = useState(null);
  const [submittedReadings, setSubmittedReadings] = useState([]);
  const [restartDialogOpen, setRestartDialogOpen] = useState(false);
  const [restartConfirmation, setRestartConfirmation] = useState("");
  const [availableRoutes, setAvailableRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [previousReadings, setPreviousReadings] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState(null);
  const [readingsData, setReadingsData] = useState([]);

  // Move combinedMeters initialization here
  const combinedMeters = useMemo(() => {
    return routeData.map((meter) => {
      const matchingReading = readingsData.find((r) => r.ID === meter.ID);
      if (matchingReading) {
        const { monthlyConsumption, averageConsumption } =
          calculateMonthlyConsumption(matchingReading);
        return {
          ...meter,
          readings: matchingReading,
          monthlyConsumption,
          averageConsumption,
        };
      }
      return {
        ...meter,
        readings: {},
        monthlyConsumption: [],
        averageConsumption: 0,
      };
    });
  }, [readingsData]);

  // Initialize readingsState from localStorage
  const [readingsState, setReadingsState] = useState(() => {
    const initialState = {};
    combinedMeters.forEach((meter) => {
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

  // Add new state for date selection
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const currentDate = new Date();
    return currentDate.getMonth();
  });

  const [selectedYear, setSelectedYear] = useState(() => {
    const currentDate = new Date();
    return currentDate.getFullYear();
  });

  // Update the useEffect for loading routes
  useEffect(() => {
    let isMounted = true;

    const loadRoutes = async () => {
      if (!isMounted) return;

      setIsLoading(true);
      try {
        const routesRef = collection(db, "routes");
        console.log("Fetching routes...");

        const routesSnapshot = await getDoc(
          doc(routesRef, "San_Lorenzo-Portal_Primavera")
        );

        if (!isMounted) return;

        if (routesSnapshot.exists()) {
          const routeData = {
            id: routesSnapshot.id,
            ...routesSnapshot.data(),
          };
          setAvailableRoutes([routeData]);
          console.log("Route loaded successfully:", routeData);
        } else {
          console.log("No routes found");
          setAvailableRoutes([]);
        }
        setError(null);
      } catch (error) {
        if (!isMounted) return;
        console.error("Error loading routes:", error);
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
  }, []); // Empty dependency array means this runs once on mount

  // Add handler for date changes
  const handleDateChange = (month, year) => {
    setSelectedMonth(month);
    setSelectedYear(year);
  };

  // Update loadPreviousReadings to get the latest version of each month
  const loadPreviousReadings = async () => {
    try {
      const startDate = getPreviousMonthYear(selectedYear, selectedMonth);
      let currentYear = startDate.year;
      let currentMonth = startDate.month;
      const readings = [];

      // Initialize all meters with ID
      routeData.forEach((meter) => {
        readings.push({ ID: meter.ID });
      });

      // Try to load last 5 months of readings
      for (let i = 0; i < 5; i++) {
        const monthPrefix = `${currentYear}-${months[currentMonth]}`;
        const monthKey = monthPrefix;

        try {
          // Get all documents for this month
          const readingsRef = collection(db, "readings");
          const q = query(
            readingsRef,
            where("year", "==", currentYear),
            where("month", "==", months[currentMonth])
          );

          const querySnapshot = await getDocs(q);

          if (!querySnapshot.empty) {
            // Sort the documents in memory instead
            const docs = querySnapshot.docs;
            docs.sort(
              (a, b) =>
                b.data().timestamp.toMillis() - a.data().timestamp.toMillis()
            );

            // Use the most recent document
            const latestDoc = docs[0];
            const monthData = latestDoc.data().readings;

            // Transform the data to include the month
            monthData.forEach((reading) => {
              const existingReading = readings.find((r) => r.ID === reading.ID);
              if (existingReading) {
                existingReading[monthKey] = reading.Reading;
              }
            });
          } else {
            // If no readings found for this month
            readings.forEach((reading) => {
              reading[monthKey] = "NO DATA";
            });
          }
        } catch (error) {
          console.log(`Failed to load readings for ${monthPrefix}:`, error);
          readings.forEach((reading) => {
            reading[monthKey] = "NO DATA";
          });
        }

        // Move to previous month
        const prev = getPreviousMonthYear(currentYear, currentMonth);
        currentYear = prev.year;
        currentMonth = prev.month;
      }

      return readings;
    } catch (error) {
      console.error("Error in loadPreviousReadings:", error);
      throw error;
    }
  };

  // Add this navigation handler
  const handleNavigationAttempt = useCallback(
    (navigationFunction) => {
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
    },
    [currentIndex, combinedMeters, readingsState]
  );

  // Wrap all navigation functions
  const handleSelectMeter = useCallback(
    (index) => {
      handleNavigationAttempt(() => setCurrentIndex(index));
    },
    [handleNavigationAttempt]
  );

  const handleHomeClick = useCallback(() => {
    handleNavigationAttempt(() => setCurrentIndex(null));
  }, [handleNavigationAttempt]);

  const handleGoToSummary = useCallback(() => {
    handleNavigationAttempt(() => setCurrentIndex(combinedMeters.length + 1));
  }, [handleNavigationAttempt, combinedMeters.length]);

  // Add this function near the top of App.jsx
  const generateCSV = (readings, month, year) => {
    // Create CSV header
    const csvRows = ["ID,Direccion,Lectura Anterior,Lectura Actual,Estado\n"];

    readings.forEach((meter) => {
      const reading = readingsState[meter.ID];
      const previousReadings = Object.entries(meter.readings)
        .filter(([k]) => k !== "ID")
        .sort((a, b) => b[0].localeCompare(a[0]));
      const lastMonthReading = previousReadings[0]?.[1] || "---";

      const status = reading?.isConfirmed
        ? "Confirmado"
        : reading?.reading
        ? "Sin Confirmar"
        : "Omitido";

      const currentReading = reading?.reading || "---";

      // Escape commas in address
      const escapedAddress = meter.ADDRESS.replace(/,/g, ";");

      csvRows.push(
        `${meter.ID},${escapedAddress},${lastMonthReading},${currentReading},${status}\n`
      );
    });

    return csvRows.join("");
  };

  // Add this before the render logic
  const handleStartClick = async () => {
    try {
      setIsLoading(true);

      // Load all 5 months of readings
      const readings = await loadPreviousReadings();
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

  const handleUploadReadings = async () => {
    let functionCall = null;

    try {
      setIsLoading(true);

      // Generate timestamp for the filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const fileName = `${selectedYear}-${months[selectedMonth]}_${timestamp}`;

      // Generate the readings data
      const readingsToUpload = combinedMeters.map((meter) => {
        const reading = readingsState[meter.ID];
        return {
          ID: meter.ID,
          Reading: reading?.reading || "---",
        };
      });

      // Create the readings document with metadata
      const readingsInfo = {
        readings: readingsToUpload,
        timestamp: new Date(),
        routeId: selectedRoute?.id || "route1",
        month: months[selectedMonth],
        year: selectedYear,
        routeName: selectedRoute?.name || "ruta1",
      };

      // Upload to Firestore
      const readingsRef = doc(db, "readings", fileName);
      await setDoc(readingsRef, readingsInfo);

      // Generate CSV content
      const csvContent = generateCSV(
        combinedMeters,
        months[selectedMonth],
        selectedYear
      );

      // Create and download CSV file
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `lecturas-${
          selectedRoute?.name || "San_Lorenzo_Portal_Primavera"
        }-${selectedYear}-${months[selectedMonth]}.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Call the cloud function with proper cleanup
      const sendReadingsMail = httpsCallable(functions, "sendReadingsMail");
      functionCall = sendReadingsMail({
        readings: combinedMeters.map((meter) => ({
          ID: meter.ID,
          ADDRESS: meter.ADDRESS,
          ...meter.readings,
          currentReading: readingsState[meter.ID]?.reading || "---",
        })),
        month: months[selectedMonth],
        year: selectedYear,
        routeName: selectedRoute?.name || "San Lorenzo Portal Primavera",
      });

      const result = await Promise.race([
        functionCall,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Timeout")), 30000)
        ),
      ]);

      console.log("Cloud function result:", result);

      // Clear local storage
      combinedMeters.forEach((meter) => {
        localStorage.removeItem(`meter_${meter.ID}_reading`);
        localStorage.removeItem(`meter_${meter.ID}_confirmed`);
      });

      // Reset state
      setReadingsState({});
      setCurrentIndex(null);

      alert("Lecturas enviadas exitosamente");
    } catch (error) {
      console.error("Error uploading readings:", error);
      if (error.message === "Timeout") {
        alert(
          "Las lecturas se enviaron pero el email puede tomar unos minutos."
        );
      } else {
        alert(
          "Error al enviar lecturas: " + (error.message || "Unknown error")
        );
      }
    } finally {
      setIsLoading(false);
      // Clean up function call if it exists
      if (functionCall && typeof functionCall.cancel === "function") {
        functionCall.cancel();
      }
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

  // Update the handleRouteSelect function in App.jsx
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

  // Update initializeRouteData to use the file name as route name
  const initializeRouteData = async () => {
    try {
      // Get route name from the file path, removing .json extension
      const routeName = "San_Lorenzo-Portal_Primavera".replace(/_/g, " "); // Replace underscores with spaces
      const routeId = "San_Lorenzo-Portal_Primavera"; // Keep original for ID

      // Initialize route
      const routeRef = doc(db, "routes", routeId);
      const routeInfo = {
        name: routeName,
        id: routeId,
        totalMeters: routeData.length,
        lastUpdated: new Date(),
        meters: routeData,
      };

      await setDoc(routeRef, routeInfo);
      console.log("Route data initialized successfully");

      // Initialize all readings files
      const allReadings = await getAllMonthlyReadings();
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

      for (const [fileName, monthlyReadings] of Object.entries(allReadings)) {
        // Create a unique filename with timestamp
        const uniqueFileName = `${fileName}_${timestamp}`;
        const readingsRef = doc(db, "readings", uniqueFileName);

        // Parse the year and month from fileName (e.g., "2025-Enero")
        const [year, month] = fileName.split("-");

        const readingsInfo = {
          readings: monthlyReadings,
          timestamp: new Date(),
          lastUpdated: new Date(),
          routeId: routeId,
          month: month,
          year: parseInt(year),
          fileName: `${fileName}.json`,
        };

        await setDoc(readingsRef, readingsInfo);
        console.log(`Initialized readings for ${uniqueFileName}`);
      }

      // Load the readings into state
      const combinedReadings = await loadPreviousReadings();
      setReadingsData(combinedReadings);

      setAvailableRoutes([
        {
          id: routeId,
          ...routeInfo,
        },
      ]);

      console.log("All data initialized successfully");
    } catch (error) {
      console.error("Error initializing data:", error);
    }
  };

  // Only one home screen branch (when currentIndex is null)
  if (currentIndex === null) {
    // Check for any readings or confirmed readings in readingsState
    const hasReadings = Object.values(readingsState).some(
      (state) => state?.reading || state?.isConfirmed
    );

    const onContinue = () => {
      setCurrentIndex(0);
    };

    const handleRestart = () => {
      setRestartDialogOpen(true);
    };

    const confirmRestart = () => {
      // Clear all readings from localStorage
      combinedMeters.forEach((meter) => {
        localStorage.removeItem(`meter_${meter.ID}_reading`);
        localStorage.removeItem(`meter_${meter.ID}_confirmed`);
      });
      // Reset readings state
      setReadingsState({});
      setRestartDialogOpen(false);
      setRestartConfirmation("");
    };

    const restartDialog = (
      <Dialog
        open={restartDialogOpen}
        onClose={() => setRestartDialogOpen(false)}
      >
        <DialogTitle>¿Está seguro que desea reiniciar?</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            Esta acción eliminará todas las lecturas ingresadas.
          </Typography>
          <Typography gutterBottom>
            Escriba "REINICIAR" para confirmar:
          </Typography>
          <TextField
            fullWidth
            value={restartConfirmation}
            onChange={(e) => setRestartConfirmation(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setRestartDialogOpen(false);
              setRestartConfirmation("");
            }}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="error"
            disabled={restartConfirmation !== "REINICIAR"}
            onClick={confirmRestart}
          >
            Confirmar Reinicio
          </Button>
        </DialogActions>
      </Dialog>
    );

    return (
      <>
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
            onContinue={onContinue}
            onRestart={handleRestart}
            routes={availableRoutes}
            onRouteSelect={handleRouteSelect}
            isLoading={isLoading}
            error={error}
            selectedRoute={selectedRoute}
            onInitialize={initializeRouteData}
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            onDateChange={handleDateChange}
          />
        </Layout>
        {restartDialog}
      </>
    );
  } else if (currentIndex >= 0 && currentIndex < combinedMeters.length) {
    // Meter screens
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
          onPrev={() =>
            handleNavigationAttempt(() => setCurrentIndex(currentIndex - 1))
          }
          onNext={() =>
            handleNavigationAttempt(() => setCurrentIndex(currentIndex + 1))
          }
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
  } else if (currentIndex === combinedMeters.length) {
    // Final check screen
    return (
      <Layout
        showSidebar={false}
        meters={combinedMeters}
        currentIndex={currentIndex}
        onSelectMeter={() => {}}
        onHomeClick={handleHomeClick}
        onFinishClick={() => setCurrentIndex(combinedMeters.length + 1)}
        readingsState={readingsState}
      >
        <FinalCheckScreen
          onGoBack={() => setCurrentIndex(combinedMeters.length - 1)}
          onFinish={() => setCurrentIndex(combinedMeters.length + 1)}
        />
      </Layout>
    );
  } else if (currentIndex === combinedMeters.length + 1) {
    // Summary screen
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
  } else {
    return <div>Estado Inválido</div>;
  }
}

export default App;

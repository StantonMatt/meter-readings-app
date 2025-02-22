// App.jsx
import React, { useState, useCallback, useEffect, useMemo } from "react";
import Layout from "./Layout";
import HomeScreen from "./HomeScreen";
import MeterScreen from "./MeterScreen";
import FinalCheckScreen from "./FinalCheckScreen";
import SummaryScreen from "./SummaryScreen";
import routeData from "./data/route.json";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
} from "@mui/material";
import { db, storage, auth } from "./firebase-config";
import { collection, getDocs, doc, setDoc, getDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

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

// Update the calculateMonthlyConsumption function
const calculateMonthlyConsumption = (readings) => {
  const months = Object.keys(readings)
    .filter((key) => key !== "ID")
    .sort(); // Sort chronologically

  const consumption = [];

  for (let i = 1; i < months.length; i++) {
    const currentReading = readings[months[i]];
    const previousReading = readings[months[i - 1]];
    const monthlyUsage = currentReading - previousReading;
    consumption.push(monthlyUsage);
  }

  // Only use the last 5 months of consumption (or less if not available)
  const recentConsumption = consumption.slice(-5);
  const average =
    recentConsumption.length > 0
      ? recentConsumption.reduce((a, b) => a + b, 0) / recentConsumption.length
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

let readingsData = [];

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

        const routesSnapshot = await getDoc(doc(routesRef, "route1"));

        if (!isMounted) return;

        if (routesSnapshot.exists()) {
          const routeData = {
            id: routesSnapshot.id,
            ...routesSnapshot.data(),
          };
          setAvailableRoutes([routeData]);
          console.log("Route loaded successfully");
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

    // Cleanup function
    return () => {
      isMounted = false;
    };
  }, []); // Empty dependency array means this runs once on mount

  // Add handler for date changes
  const handleDateChange = (month, year) => {
    setSelectedMonth(month);
    setSelectedYear(year);
  };

  // Update loadPreviousReadings function
  const loadPreviousReadings = async (routeName) => {
    try {
      // Calculate the previous month's file name
      const prevDate = new Date(selectedYear, selectedMonth - 1);
      const prevMonthFileName = `${getFormattedMonthYear(prevDate)}-readings`;

      console.log(`Looking for previous readings file: ${prevMonthFileName}`);

      // Try to get readings from Firestore
      const readingsRef = doc(db, "readings", prevMonthFileName);
      const readingsDoc = await getDoc(readingsRef);

      let loadedReadings;

      if (readingsDoc.exists()) {
        console.log(
          `Found readings for ${
            months[prevDate.getMonth()]
          } ${prevDate.getFullYear()}`
        );
        loadedReadings = readingsDoc.data().readings;
      } else {
        // If not found, try loading the file from one month before
        const twoMonthsAgoDate = new Date(selectedYear, selectedMonth - 2);
        const twoMonthsAgoFileName = `${getFormattedMonthYear(
          twoMonthsAgoDate
        )}-readings`;

        console.log(
          `Trying previous month's readings: ${twoMonthsAgoFileName}`
        );

        const previousReadingsRef = doc(db, "readings", twoMonthsAgoFileName);
        const previousReadingsDoc = await getDoc(previousReadingsRef);

        if (previousReadingsDoc.exists()) {
          console.log(
            `Found readings for ${
              months[twoMonthsAgoDate.getMonth()]
            } ${twoMonthsAgoDate.getFullYear()}`
          );
          loadedReadings = previousReadingsDoc.data().readings;
        } else {
          console.log("No previous readings found, using local data");
          loadedReadings = readingsData;
        }
      }

      // Ensure consistent date sorting for each meter's readings
      loadedReadings = loadedReadings.map((meter) => {
        const sortedReadings = {};

        // Keep the ID
        sortedReadings.ID = meter.ID;

        // Get all date entries and sort them
        const dateEntries = Object.entries(meter)
          .filter(([key]) => key !== "ID")
          .sort((a, b) => {
            const [yearA, monthA] = a[0].split("-");
            const [yearB, monthB] = b[0].split("-");

            const monthToNum = {
              Ene: 1,
              Feb: 2,
              Mar: 3,
              Abr: 4,
              May: 5,
              Jun: 6,
              Jul: 7,
              Ago: 8,
              Sep: 9,
              Oct: 10,
              Nov: 11,
              Dic: 12,
            };

            // Compare years first
            if (yearA !== yearB) {
              return parseInt(yearA) - parseInt(yearB);
            }

            // If years are equal, compare months
            return monthToNum[monthA] - monthToNum[monthB];
          });

        // Add sorted entries back to the object
        dateEntries.forEach(([key, value]) => {
          sortedReadings[key] = value;
        });

        return sortedReadings;
      });

      readingsData = loadedReadings;
      return loadedReadings;
    } catch (error) {
      console.error("Error loading readings:", error);
      return readingsData;
    }
  };

  const handleHomeClick = () => {
    setCurrentIndex(null);
  };

  // Update handleFinishClick to properly format and save the data
  const handleUploadReadings = async () => {
    try {
      if (selectedRoute) {
        // Format current month's filename
        const currentFileName = `${selectedYear}-${months[selectedMonth]
          .substring(0, 3)
          .toLowerCase()}-readings`;

        console.log("Starting save process...");

        // Get the previous readings to include the past 4 months
        const previousReadings = await loadPreviousReadings(selectedRoute.name);

        // Create new readings array with sliding 5-month window
        const updatedReadings = combinedMeters.map((meter) => {
          const { ID } = meter;
          let newReading = { ID };

          // Get previous readings for this meter
          const prevReading = previousReadings.find((r) => r.ID === ID);
          if (prevReading) {
            // Get all readings except ID and sort them chronologically
            const sortedReadings = Object.entries(prevReading)
              .filter(([key]) => key !== "ID")
              .sort((a, b) => {
                const [yearA, monthA] = a[0].split("-");
                const [yearB, monthB] = b[0].split("-");
                return (
                  new Date(`${yearA}-${monthA}-01`).getTime() -
                  new Date(`${yearB}-${monthB}-01`).getTime()
                );
              });

            // Take only the most recent 4 readings
            const recentReadings = sortedReadings.slice(-4);

            // Add those 4 months in chronological order
            recentReadings.forEach(([month, value]) => {
              newReading[month] = value;
            });
          }

          // Add current month's reading (use 0 if not confirmed)
          const currentReading = readingsState[ID]?.reading;
          const isConfirmed = readingsState[ID]?.isConfirmed;
          newReading[`${selectedYear}-${months[selectedMonth]}`] = isConfirmed
            ? Number(currentReading)
            : 0;

          return newReading;
        });

        console.log("Saving to Firestore...");

        // Save to Firestore
        const readingsRef = doc(db, "readings", currentFileName);
        await setDoc(readingsRef, {
          readings: updatedReadings,
          lastUpdated: new Date(),
          routeId: selectedRoute.id,
          fileName: `${currentFileName}.json`,
        });

        console.log(`Readings saved as ${currentFileName}`);

        // Update route document
        const routeRef = doc(db, "routes", selectedRoute.id);
        await setDoc(
          routeRef,
          {
            lastUpdated: new Date(),
            latestReadings: `${currentFileName}.json`,
          },
          { merge: true }
        );

        // Clear local storage
        combinedMeters.forEach((meter) => {
          localStorage.removeItem(`meter_${meter.ID}_reading`);
          localStorage.removeItem(`meter_${meter.ID}_confirmed`);
        });

        alert("Lecturas guardadas exitosamente");
        setCurrentIndex(null); // Return to home screen
        setReadingsState({}); // Clear readings state
      }
    } catch (error) {
      console.error("Error saving readings:", error);
      alert(
        "Hubo un error al guardar las lecturas. Por favor intente nuevamente."
      );
    }
  };

  // Add a new function for navigating to summary
  const handleGoToSummary = () => {
    setCurrentIndex(combinedMeters.length + 1);
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

  // Add a new function to handle the start button click
  const handleStartClick = async () => {
    try {
      setIsLoading(true);

      // Load previous readings when starting
      let readings;
      try {
        readings = await loadPreviousReadings(selectedRoute.name);
      } catch (error) {
        console.log("Failed to load cloud readings, using local data");
        readings = readingsData;
      }

      // Merge readings with route data
      const updatedMeters = routeData.map((meter) => {
        const matchingReading = readings.find((r) => r.ID === meter.ID);
        return { ...meter, readings: matchingReading || {} };
      });

      // Update state
      setPreviousReadings(readings);
      setCurrentIndex(0); // Move to meter screen
    } catch (error) {
      console.error("Error in handleStartClick:", error);
      setError("Failed to load route data. Using local data.");
      // Still allow starting with local data
      setCurrentIndex(0);
    } finally {
      setIsLoading(false);
    }
  };

  // Move these functions inside App component
  const initializeReadingsData = async () => {
    try {
      // Get current date for the filename
      const today = new Date();
      const monthStr = months[today.getMonth() - 1]
        .substring(0, 3)
        .toLowerCase(); // Get previous month
      const year = today.getFullYear();
      const fileName = `${year}-${monthStr}-readings`;

      const readingsRef = doc(db, "readings", fileName);

      const formattedReadings = readingsData.map((reading) => {
        const newReading = { ID: reading.ID };
        Object.entries(reading).forEach(([key, value]) => {
          if (key !== "ID") {
            // Keep the existing date format from the file
            newReading[key] = value;
          }
        });
        return newReading;
      });

      const readingsInfo = {
        readings: formattedReadings,
        lastUpdated: new Date(),
        routeId: "route1",
        fileName: `${fileName}.json`,
      };

      await setDoc(readingsRef, readingsInfo);
      console.log(`Readings data initialized successfully as ${fileName}`);
    } catch (error) {
      console.error("Error initializing readings data:", error);
    }
  };

  const initializeRouteData = async () => {
    try {
      const routeRef = doc(db, "routes", "route1");

      const today = new Date();
      const monthStr = months[today.getMonth() - 1]
        .substring(0, 3)
        .toLowerCase();
      const year = today.getFullYear();
      const fileName = `${year}-${monthStr}-readings.json`;

      const routeInfo = {
        name: "ruta1",
        totalMeters: routeData.length,
        lastUpdated: new Date(),
        latestReadings: fileName,
        meters: routeData,
      };

      await setDoc(routeRef, routeInfo);
      console.log("Route data initialized successfully");

      await initializeReadingsData();

      setAvailableRoutes([
        {
          id: "route1",
          ...routeInfo,
        },
      ]);
    } catch (error) {
      console.error("Error initializing route data:", error);
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
        onSelectMeter={(i) => setCurrentIndex(i)}
        onHomeClick={handleHomeClick}
        onFinishClick={handleGoToSummary}
        readingsState={readingsState}
      >
        <MeterScreen
          meter={combinedMeters[currentIndex]}
          currentIndex={currentIndex}
          totalMeters={combinedMeters.length}
          onHome={handleHomeClick}
          onPrev={() => setCurrentIndex((prev) => prev - 1)}
          onNext={() => setCurrentIndex((prev) => prev + 1)}
          onFinish={handleGoToSummary}
          onReadingChange={handleReadingChange}
          onConfirmationChange={handleConfirmationChange}
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

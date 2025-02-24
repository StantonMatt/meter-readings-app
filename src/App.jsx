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
import {
  db,
  storage,
  auth,
  functions,
  appCheck,
  appCheckInitialized,
} from "./firebase-config";
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
import {
  getFunctions,
  httpsCallable,
  connectFunctionsEmulator,
} from "firebase/functions";
import { onAuthStateChanged } from "firebase/auth";
import LoginScreen from "./LoginScreen";
import { getToken } from "firebase/app-check";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import EmailPreview from "./EmailPreview";

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
  // Get all readings except ID and ADDRESS, convert to array of [date, value] pairs
  const readingsArray = Object.entries(readings)
    .filter(([key]) => key !== "ID" && key !== "ADDRESS")
    .map(([date, value]) => ({
      date,
      value: value === "---" || value === "NO DATA" ? null : parseFloat(value),
    }))
    .sort((a, b) => {
      const [yearA, monthA] = a.date.split("-");
      const [yearB, monthB] = b.date.split("-");
      const yearDiff = parseInt(yearB) - parseInt(yearA);
      if (yearDiff !== 0) return yearDiff;
      const monthOrder = {
        Enero: 1,
        Febrero: 2,
        Marzo: 3,
        Abril: 4,
        Mayo: 5,
        Junio: 6,
        Julio: 7,
        Agosto: 8,
        Septiembre: 9,
        Octubre: 10,
        Noviembre: 11,
        Diciembre: 12,
      };
      return monthOrder[monthB] - monthOrder[monthA];
    });

  const consumption = [];
  for (let i = 0; i < readingsArray.length - 1; i++) {
    const current = readingsArray[i].value;
    const previous = readingsArray[i + 1].value;
    if (current !== null && previous !== null) {
      const monthlyUsage = current - previous;
      if (monthlyUsage >= 0) {
        consumption.push(monthlyUsage);
      }
    }
  }

  const recentConsumption = consumption.slice(0, 5);
  const average =
    recentConsumption.length > 0
      ? recentConsumption.reduce((sum, value) => sum + value, 0) /
        recentConsumption.length
      : 0;

  let estimatedReading = null;
  let monthsToEstimate = 1;

  // Find the last valid reading
  for (const reading of readingsArray) {
    if (reading.value !== null) {
      estimatedReading = reading.value + average * monthsToEstimate;
      break;
    }
    monthsToEstimate++;
  }

  return {
    monthlyConsumption: consumption,
    averageConsumption: Math.round(average * 100) / 100,
    estimatedReading:
      estimatedReading !== null ? Math.round(estimatedReading) : null,
    monthsEstimated: monthsToEstimate,
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

// Add this helper function near the top of App.jsx
const findFirstPendingMeter = (meters, readingsState) => {
  const index = meters.findIndex((meter) => {
    const state = readingsState[meter.ID];
    return !state || !state.isConfirmed; // Return true for unfilled or unconfirmed readings
  });
  return index === -1 ? 0 : index; // Return 0 if no pending meters found
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
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  // Move combinedMeters initialization here
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

  // Update the readingsState initialization and setter
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

  // Add this useEffect near the top of your App component
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setAuthChecked(true);
    });

    return () => unsubscribe();
  }, []);

  // Update the useEffect for loading routes
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
          await initializeRouteData();
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
  }, [user]); // Add user to dependencies

  // Update the setupAdmin useEffect
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
    try {
      setIsLoading(true);
      setError(null);

      // Wait for App Check token
      const isInitialized = await appCheckInitialized;
      if (!isInitialized) {
        throw new Error("App Check initialization failed");
      }

      // Verify user is authenticated
      if (!auth.currentUser) {
        throw new Error("User not authenticated");
      }

      // Generate standardized timestamp format: YYYY-MM-DDThh-mm-ss-SSS
      const now = new Date();
      const timestamp = now
        .toISOString()
        .replace(/[:.]/g, "-")
        .replace("Z", "");

      // Create standardized filename format
      const fileName = timestamp;

      // Collect all verification data
      const verifications = combinedMeters.reduce((acc, meter) => {
        const verificationKey = "meter_" + meter.ID + "_verification";
        const verificationRaw = localStorage.getItem(verificationKey);
        if (verificationRaw) {
          try {
            const verification = JSON.parse(verificationRaw);
            if (verification) {
              acc.push({
                meterId: meter.ID,
                address: meter.ADDRESS,
                ...verification,
              });
            }
          } catch (error) {
            console.error(
              "Error parsing verification data for meter " + meter.ID + ":",
              error
            );
          }
        }
        return acc;
      }, []);

      // Generate the readings data
      const readingsToUpload = combinedMeters.map((meter) => {
        const reading = readingsState[meter.ID];
        const verification = verifications.find((v) => v.meterId === meter.ID);

        return {
          ID: meter.ID,
          Reading: reading?.reading || "---",
          verification: verification || null,
        };
      });

      // Create the readings document with metadata
      const readingsInfo = {
        readings: readingsToUpload,
        timestamp: now,
        routeId: selectedRoute?.id || "San_Lorenzo-Portal_Primavera",
        month: months[selectedMonth],
        year: parseInt(selectedYear),
        verifications: verifications,
      };

      // Upload to Firestore
      const readingsRef = doc(db, "readings", fileName);
      await setDoc(readingsRef, readingsInfo);

      // Generate and download CSV file
      const csvContent = generateCSV(
        combinedMeters,
        months[selectedMonth],
        selectedYear
      );

      // Create email content from verifications
      const emailContent = combinedMeters
        .filter((meter) => {
          const reading = readingsState[meter.ID]?.reading;
          const isConfirmed = readingsState[meter.ID]?.isConfirmed;
          const verificationKey = "meter_" + meter.ID + "_verification";
          const verificationRaw = localStorage.getItem(verificationKey);
          let verificationData = null;

          try {
            verificationData = verificationRaw
              ? JSON.parse(verificationRaw)
              : null;
          } catch (error) {
            console.error(
              "Error parsing verification for meter " + meter.ID + ":",
              error
            );
          }

          return reading && isConfirmed && verificationData;
        })
        .map((meter) => {
          const reading = readingsState[meter.ID]?.reading;
          const sortedReadings = Object.entries(meter.readings)
            .filter(([k]) => k !== "ID")
            .sort((a, b) => b[0].localeCompare(a[0]));
          const lastReading = sortedReadings[0]?.[1] || "---";
          const consumption =
            reading !== "---" && lastReading !== "---"
              ? Number(reading) - Number(lastReading)
              : "---";

          const verificationKey = "meter_" + meter.ID + "_verification";
          const verificationData = JSON.parse(
            localStorage.getItem(verificationKey) || "null"
          );

          let meterInfo = [
            "CLIENTE: " + meter.ID,
            "DIRECCIÓN: " + meter.ADDRESS,
            "LECTURA ANTERIOR: " + lastReading,
            "LECTURA ACTUAL: " + reading,
            "CONSUMO: " + consumption + " m³",
          ].join("\n");

          if (verificationData?.type === "lowConsumption") {
            meterInfo += "\n\nNOTA DE VERIFICACIÓN:";
            if (verificationData.details.answeredDoor) {
              meterInfo += [
                "\n• Atendió el cliente: Sí",
                "\n• Reportó problemas con el agua: " +
                  (verificationData.details.hadIssues ? "Sí" : "No"),
                "\n• Tiempo viviendo en la casa: " +
                  verificationData.details.residenceMonths +
                  " meses",
              ].join("");
            } else {
              meterInfo += [
                "\n• Atendió el cliente: No",
                "\n• Casa parece habitada: " +
                  (verificationData.details.looksLivedIn ? "Sí" : "No"),
              ].join("");
            }
          }

          return meterInfo;
        })
        .join("\n----------------------------------------\n");

      // Call the cloud function
      const sendReadingsMail = httpsCallable(functions, "sendReadingsMail");
      await sendReadingsMail({
        readings: readingsToUpload,
        routeId: selectedRoute?.id || "San_Lorenzo-Portal_Primavera",
        month: months[selectedMonth],
        year: selectedYear,
        emailContent: emailContent,
      });

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
      setSubmittedReadings(readingsToUpload);
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
      setIsLoading(true);
      setError(null);

      // Wait for App Check token and verify auth
      const isInitialized = await appCheckInitialized;
      if (!isInitialized) {
        throw new Error("App Check initialization failed");
      }
      if (!auth.currentUser) {
        throw new Error("User not authenticated");
      }

      // Initialize route
      const routeId = "San_Lorenzo-Portal_Primavera";
      const routeRef = doc(db, "routes", routeId);

      const routeInfo = {
        name: routeId.replace(/_/g, " "),
        id: routeId,
        totalMeters: routeData.length,
        lastUpdated: new Date(),
        meters: routeData,
      };

      await setDoc(routeRef, routeInfo, { merge: true });
      console.log("Route data updated successfully");

      // Initialize readings
      const readingsCollectionRef = collection(db, "readings");
      const readingsContext = import.meta.glob("./data/readings/*.json");

      console.log("Found files:", Object.keys(readingsContext));

      for (const path in readingsContext) {
        try {
          const module = await readingsContext[path]();
          const readingsData = module.default;

          // Get exact filename without extension
          const fileName = path.split("/").pop().replace(".json", "");

          // Extract year and month from filename (e.g., "2024-09-00T00-00-00-000")
          const [year, month] = fileName.split("-");

          const readingDocRef = doc(readingsCollectionRef, fileName);

          await setDoc(
            readingDocRef,
            {
              readings: readingsData,
              routeId: routeId,
              month: months[parseInt(month) - 1], // Convert month number to name
              year: parseInt(year),
              timestamp: new Date(),
            },
            { merge: true }
          );

          console.log(`Successfully initialized readings for ${fileName}`);
        } catch (error) {
          console.error(`Failed to process file ${path}:`, error);
        }
      }

      // Initialize email config if needed
      const emailConfigRef = doc(db, "config", "email");
      const emailConfigDoc = await getDoc(emailConfigRef);

      if (!emailConfigDoc.exists()) {
        await setDoc(emailConfigRef, {
          recipients: ["stantonmatthewj@gmail.com", "matthew@temuco.com"],
        });
        console.log("Email config initialized");
      }

      // Update local state
      setAvailableRoutes([
        {
          id: routeId,
          ...routeInfo,
        },
      ]);

      setError(null);
      console.log("All data initialized successfully");
    } catch (error) {
      console.error("Detailed initialization error:", error);
      setError(`Error initializing data: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Update the onViewSummary function
  const onViewSummary = useCallback(() => {
    const readingsToUpload = combinedMeters.map((meter) => ({
      ID: meter.ID,
      ADDRESS: meter.ADDRESS,
      ...meter.readings,
      currentReading: readingsState[meter.ID]?.reading || "---",
    }));

    const emailContent = combinedMeters
      .filter((meter) => {
        const reading = readingsState[meter.ID]?.reading;
        const isConfirmed = readingsState[meter.ID]?.isConfirmed;
        const verificationRaw = localStorage.getItem(
          `meter_${meter.ID}_verification`
        );
        let verificationData = null;
        try {
          verificationData =
            verificationRaw &&
            verificationRaw.trim() !== "" &&
            verificationRaw.trim().toLowerCase() !== "null"
              ? JSON.parse(verificationRaw)
              : null;
        } catch (error) {
          verificationData = null;
        }
        // Only include if verificationData exists and is explicitly for lowConsumption
        return (
          reading &&
          isConfirmed &&
          verificationData &&
          verificationData.type === "lowConsumption"
        );
      })
      .map((meter) => {
        const reading = readingsState[meter.ID]?.reading;
        const sortedReadings = Object.entries(meter.readings)
          .filter(([k]) => k !== "ID")
          .sort((a, b) => b[0].localeCompare(a[0]));
        const lastReading = sortedReadings[0]?.[1] || "---";
        const consumption =
          reading !== "---" && lastReading !== "---"
            ? Number(reading) - Number(lastReading)
            : "---";

        const verificationData = JSON.parse(
          localStorage.getItem(`meter_${meter.ID}_verification`) || "null"
        );

        let meterInfo = `
CLIENTE: ${meter.ID}
DIRECCIÓN: ${meter.ADDRESS}
LECTURA ANTERIOR: ${lastReading}
LECTURA ACTUAL: ${reading}
CONSUMO: ${consumption} m³`;

        if (verificationData?.type === "lowConsumption") {
          meterInfo += `\n\nNOTA DE VERIFICACIÓN:`;
          if (verificationData.details.answeredDoor) {
            meterInfo += `
• Atendió el cliente: Sí
• Reportó problemas con el agua: ${
              verificationData.details.hadIssues ? "Sí" : "No"
            }
• Tiempo viviendo en la casa: ${
              verificationData.details.residenceMonths
            } meses`;
          } else {
            meterInfo += `
• Atendió el cliente: No
• Casa parece habitada: ${verificationData.details.looksLivedIn ? "Sí" : "No"}`;
          }
        }

        return meterInfo + "\n----------------------------------------";
      })
      .join("\n\n");

    setSubmittedReadings(readingsToUpload);
    setCurrentIndex(combinedMeters.length);
  }, [combinedMeters, readingsState]);

  // Add this loading check before your main render
  if (!authChecked) {
    return null; // Or a loading spinner
  }

  // If no user is logged in, show login screen
  if (!user) {
    return <LoginScreen />;
  }

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
        </Routes>
        {restartDialog}
      </BrowserRouter>
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
    // Show FinalCheckScreen after readings are submitted
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

    // Show regular summary screen if readings haven't been submitted
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

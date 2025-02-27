import React, { useState, useEffect, useMemo, useRef } from "react";

import {
  Paper,
  Typography,
  Box,
  Button,
  TextField,
  Container,
  FormControlLabel,
  RadioGroup,
  Radio,
  FormLabel,
  FormControl,
  Grid,
  Chip,
  Divider,
  Card,
  CardContent,
  alpha,
  useTheme,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Alert,
  InputAdornment,
  List,
  ListItem,
  ListItemText,
} from "@mui/material";

import { MeterData, ReadingsState } from "./utils/readingUtils";
import { months } from "./utils/dateUtils";

import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningIcon from "@mui/icons-material/Warning";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";

import { findPreviousMonthReading } from "./utils/dateUtils";
import { getPreviousReadings } from "./services/firebaseService";

interface VerificationData {
  type: string;
  details: {
    answeredDoor?: boolean;
    hadIssues?: boolean;
    residenceMonths?: number;
    looksLivedIn?: boolean;
    [key: string]: any;
  };
  timestamp: string;
  [key: string]: any;
}

interface MeterScreenProps {
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
  routeId: string | null;
  onUpdateReadings: (updatedReadings: ReadingsState) => void;
  reading: string;
  isConfirmed: boolean;
}

// Format month helpers
const formatMonthOnly = (dateKey: string): string => {
  const parts = dateKey.split("-");
  if (parts.length >= 2) {
    return parts[1].charAt(0).toUpperCase() + parts[1].slice(1);
  }
  return dateKey;
};

// Add this helper component at the top of your file
const SafeDisplay = ({ children }: { children: any }) => {
  if (children === null || children === undefined) {
    return null;
  }

  if (typeof children === "object" && !React.isValidElement(children)) {
    // Handle array special case
    if (Array.isArray(children)) {
      return (
        <>
          {children.map((item, i) => (
            <SafeDisplay key={`item-${i}`}>{item}</SafeDisplay>
          ))}
        </>
      );
    }

    // Format object to string
    return <>{JSON.stringify(children)}</>;
  }

  return <>{children}</>;
};

function MeterScreen({
  meter,
  currentIndex,
  totalMeters,
  onHome,
  onPrev,
  onNext,
  onFinish,
  onReadingChange,
  onConfirmationChange,
  pendingNavigation,
  setPendingNavigation,
  setNavigationHandledByChild,
  selectedMonth,
  selectedYear,
  routeId,
  onUpdateReadings,
  reading,
  isConfirmed: propIsConfirmed,
}: MeterScreenProps): JSX.Element {
  const theme = useTheme();

  // Create unique keys for this meter's reading and confirmation state
  const readingKey = `meter_${meter.ID}_reading`;
  const confirmedKey = `meter_${meter.ID}_confirmed`;

  // We need a LOCAL inputValue separate from the persisted reading
  const [inputValue, setInputValue] = useState<string>("");
  const [localIsConfirmed, setLocalIsConfirmed] =
    useState<boolean>(propIsConfirmed);

  // Add state for navigation dialog
  const [isNavigationDialogOpen, setIsNavigationDialogOpen] =
    useState<boolean>(false);
  const [navigationType, setNavigationType] = useState<string>("none");

  // Add new state variables for verification dialogs
  const [showLowConsumptionDialog, setShowLowConsumptionDialog] =
    useState<boolean>(false);
  const [verificationStep, setVerificationStep] = useState<number>(1);
  const [verificationData, setVerificationData] = useState<{
    answeredDoor?: boolean;
    hadIssues?: boolean;
    issueDescription?: string;
    residenceMonths?: string;
    looksLivedIn?: boolean;
  }>({});

  // Add state for unconfirm dialog
  const [showUnconfirmDialog, setShowUnconfirmDialog] =
    useState<boolean>(false);

  // Add a new state for negative consumption dialog
  const [showNegativeConsumptionDialog, setShowNegativeConsumptionDialog] =
    useState<boolean>(false);

  // Add this new state variable with the other dialog states
  const [showHighConsumptionDialog, setShowHighConsumptionDialog] =
    useState<boolean>(false);

  // Initialize input value and confirmation status when meter changes
  useEffect(() => {
    // Retrieve stored reading from localStorage
    const storedReading = localStorage.getItem(readingKey) || "";
    setInputValue(storedReading);

    // Also retrieve stored confirmation status
    const storedConfirmation = localStorage.getItem(confirmedKey) === "true";
    setLocalIsConfirmed(storedConfirmation);
  }, [meter.ID, readingKey, confirmedKey]);

  // Load previous readings for the current meter
  const [previousReadingEntries, setPreviousReadingEntries] = useState<any[]>(
    []
  );
  const [hasPreviousReadings, setHasPreviousReadings] =
    useState<boolean>(false);
  const [historicalReadings, setHistoricalReadings] = useState<any[]>([]);
  const [previousReading, setPreviousReading] = useState<any>(null);

  // Add a ref to track if we've already fetched for this meter
  const hasFetchedRef = useRef<{ [key: string]: boolean }>({});

  // Add state variables for average consumption and estimated reading if they don't exist
  const [averageConsumption, setAverageConsumption] = useState<number>(
    meter.averageConsumption || 0
  );
  const [estimatedReading, setEstimatedReading] = useState<number | string>(
    meter.estimatedReading || 0
  );

  useEffect(() => {
    let isMounted = true;

    // Create a unique request ID for this meter/route combination
    const requestId = `meter_${meter.ID}_route_${routeId}_request`;

    const fetchPreviousReadings = async () => {
      // Check if this exact API call is already in progress
      if ((window as any)[requestId]) {
        console.log(`Request already in progress for meter ${meter.ID}`);
        return;
      }

      // Set flag to indicate this request is in progress
      (window as any)[requestId] = true;

      try {
        console.log(
          `Fetching previous readings for meter ${meter.ID} in route ${routeId}`
        );

        const response = await getPreviousReadings(
          meter.ID.toString(),
          routeId
        );

        if (!isMounted) return;

        if (response && response.readings) {
          // Extract reading entries for display
          const entries = Object.entries(response.readings)
            .map(([key, value]) => ({
              date: key,
              value:
                typeof value === "number" ? value : parseFloat(String(value)),
            }))
            .filter((entry) => !isNaN(entry.value))
            .sort((a, b) => b.date.localeCompare(a.date)); // Sort newest first

          // Filter to only include entries from the 5 previous months from selected date
          const filteredEntries = filterEntriesForSelectedDate(
            entries,
            selectedMonth,
            selectedYear
          );
          console.log("Filtered entries for selected date:", filteredEntries);

          // Calculate average consumption from available readings
          const validEntries = entries.filter(
            (entry) => typeof entry.value === "number"
          );

          // Log all entries with their dates for debugging
          console.log(
            "All valid entries before sorting:",
            validEntries.map((e) => `${e.date}: ${e.value}`)
          );

          // Parse dates and sort properly (oldest to newest)
          validEntries.sort((a, b) => {
            // Parse dates like "2023-enero" by extracting year and month
            const [yearA, monthA] = a.date.split("-");
            const [yearB, monthB] = b.date.split("-");

            // First compare years
            const yearDiff = parseInt(yearA) - parseInt(yearB);
            if (yearDiff !== 0) return yearDiff;

            // If same year, compare months by their names (using the monthOrder map)
            const months = {
              enero: 1,
              febrero: 2,
              marzo: 3,
              abril: 4,
              mayo: 5,
              junio: 6,
              julio: 7,
              agosto: 8,
              septiembre: 9,
              octubre: 10,
              noviembre: 11,
              diciembre: 12,
            };

            return (
              months[monthA.toLowerCase() as keyof typeof months] -
              months[monthB.toLowerCase() as keyof typeof months]
            );
          });

          // Log sorted entries to confirm order
          console.log(
            "Sorted entries (oldest to newest):",
            validEntries.map((e) => `${e.date}: ${e.value}`)
          );

          // Calculate consumption between consecutive readings
          const consumptionValues = [];
          for (let i = 0; i < validEntries.length - 1; i++) {
            const oldReading = validEntries[i].value;
            const newReading = validEntries[i + 1].value;
            const diff = newReading - oldReading; // Newer reading minus older reading

            // Only include positive consumption values
            if (diff > 0) {
              console.log(
                `Consumption ${validEntries[i].date} to ${
                  validEntries[i + 1].date
                }: ${diff}`
              );
              consumptionValues.push(diff);
            } else {
              console.log(
                `Skipping negative/zero consumption ${
                  validEntries[i].date
                } to ${validEntries[i + 1].date}: ${diff}`
              );
            }
          }

          // Calculate average consumption
          console.log(
            "Consumption values used for average:",
            consumptionValues
          );
          let avgConsumption = 0;
          if (consumptionValues.length > 0) {
            const sum = consumptionValues.reduce((acc, val) => acc + val, 0);
            console.log("Sum of consumption values:", sum);
            console.log(
              "Number of consumption values:",
              consumptionValues.length
            );

            avgConsumption = sum / consumptionValues.length;
            avgConsumption = Math.round(avgConsumption * 10) / 10;
            console.log("Final average consumption:", avgConsumption);
          }

          // Calculate the estimated reading with correct business logic
          let estimatedValue: number | string = "---";
          if (validEntries.length > 0 && avgConsumption > 0) {
            // Get the most recent reading
            const mostRecentEntry = validEntries[validEntries.length - 1];
            const [entryYear, entryMonthName] = mostRecentEntry.date.split("-");

            const entryMonth =
              months[entryMonthName.toLowerCase() as keyof typeof months] ?? 0;
            const entryYearNum = parseInt(entryYear);

            // Get current month/year for comparison
            console.log(
              "Current month/year in the app:",
              selectedMonth,
              selectedYear
            );
            console.log(
              "Entry month/year from reading:",
              entryMonth,
              entryYearNum
            );

            // IMPORTANT: Calculate inclusive months to estimate - count current month too
            let monthsToEstimate = 0;

            // For February 2025 from January 2025, we want to estimate 2 months
            if (selectedYear === entryYearNum) {
              // Same year - simple calculation + 1 for inclusive
              monthsToEstimate = Number(selectedMonth) - Number(entryMonth) + 1;
            } else if (selectedYear > entryYearNum) {
              // Different years
              monthsToEstimate =
                (Number(selectedYear) - Number(entryYearNum)) * 12 +
                (Number(selectedMonth) - Number(entryMonth)) +
                1;
            }

            // Make sure we always estimate at least 1 month
            monthsToEstimate = Math.max(1, monthsToEstimate);

            console.log(
              "FIXED CALCULATION - Months to estimate:",
              monthsToEstimate
            );

            // Now calculate the estimated reading
            const baseReading = mostRecentEntry.value;
            const estimatedNumber = Math.round(
              baseReading + avgConsumption * monthsToEstimate
            );
            estimatedValue = estimatedNumber;

            console.log("Base reading:", baseReading);
            console.log("Average consumption:", avgConsumption);
            console.log(
              "FORMULA:",
              `${baseReading} + (${avgConsumption} × ${monthsToEstimate}) = ${estimatedNumber}`
            );
          }

          // Update UI elements
          if (filteredEntries.length > 0) {
            setPreviousReadingEntries(filteredEntries);
            setHistoricalReadings(filteredEntries);
            setHasPreviousReadings(true);

            // Store the most recent reading for consumption calculations
            if (validEntries.length > 0) {
              setPreviousReading(validEntries[0].value);
            }

            // Store average consumption and estimated reading
            setAverageConsumption(avgConsumption);
            setEstimatedReading(estimatedValue);
          } else {
            setHasPreviousReadings(false);
          }
        } else {
          setHasPreviousReadings(false);
        }
      } catch (error) {
        console.error("Error fetching previous readings:", error);
        setHasPreviousReadings(false);
      } finally {
        // Clear the in-progress flag when done
        if (isMounted) {
          (window as any)[requestId] = false;
        }
      }
    };

    // Only run if we don't already have readings data
    if (!historicalReadings || historicalReadings.length === 0) {
      fetchPreviousReadings();
    }

    return () => {
      isMounted = false;
      // Also clear the request flag when component unmounts
      (window as any)[requestId] = false;
    };
  }, [meter.ID, routeId, selectedMonth, selectedYear, historicalReadings]);

  // Helper function to get previous months
  const getPreviousMonths = (month: number, year: number, count: number) => {
    const result = [];
    let currentMonth = month;
    let currentYear = year;

    for (let i = 0; i < count; i++) {
      // Move to previous month
      currentMonth--;
      if (currentMonth === 0) {
        currentMonth = 12;
        currentYear--;
      }

      result.push({ month: currentMonth, year: currentYear });
    }

    return result;
  };

  // Update the filterEntriesForSelectedDate function to ensure all 5 months are displayed
  const filterEntriesForSelectedDate = (
    entries: any[],
    selectedMonth: number,
    selectedYear: number
  ) => {
    // Convert month names to numbers for comparison
    const monthNameToNumber: { [key: string]: number } = {
      enero: 1,
      febrero: 2,
      marzo: 3,
      abril: 4,
      mayo: 5,
      junio: 6,
      julio: 7,
      agosto: 8,
      septiembre: 9,
      octubre: 10,
      noviembre: 11,
      diciembre: 12,
    };

    // Convert number to month name for display
    const monthNumberToName: { [key: number]: string } = {
      1: "enero",
      2: "febrero",
      3: "marzo",
      4: "abril",
      5: "mayo",
      6: "junio",
      7: "julio",
      8: "agosto",
      9: "septiembre",
      10: "octubre",
      11: "noviembre",
      12: "diciembre",
    };

    // Get the 5 previous months (including the selected month)
    const relevantMonths = [
      { month: selectedMonth, year: selectedYear },
      ...getPreviousMonths(selectedMonth, selectedYear, 4),
    ];

    console.log("Relevant months:", relevantMonths);

    // Create a map of existing entries keyed by year-month
    const entriesMap = new Map();
    entries.forEach((entry) => {
      const [yearStr, monthName] = entry.date.split("-");
      const year = parseInt(yearStr);
      const month = monthNameToNumber[monthName.toLowerCase()];
      if (year && month) {
        entriesMap.set(`${year}-${month}`, entry);
      }
    });

    // Create a complete list of entries (including placeholders for missing months)
    const completeEntries = relevantMonths.map(({ month, year }) => {
      const key = `${year}-${month}`;
      if (entriesMap.has(key)) {
        return entriesMap.get(key);
      } else {
        // Create placeholder for missing month
        return {
          date: `${year}-${monthNumberToName[month]}`,
          value: "no data",
          isMissing: true, // Flag to identify placeholder entries
        };
      }
    });

    return completeEntries;
  };

  // Reference to store the calculated consumption
  const currentConsumptionRef = useRef<number | null>(null);

  // Update the handleInputChange function to directly find the previous month's reading
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);

    // Update localStorage and parent component
    localStorage.setItem(readingKey, newValue);
    onReadingChange(meter.ID, newValue);

    // Calculate consumption with proper logging
    if (meter.readings) {
      try {
        const currentReading = parseFloat(newValue);

        if (!isNaN(currentReading)) {
          // Get selected date and previous month date
          const selectedDate = new Date(selectedYear, selectedMonth);
          const prevDate = new Date(selectedDate);
          prevDate.setMonth(prevDate.getMonth() - 1);
          const prevYear = prevDate.getFullYear();
          const prevMonth = prevDate.getMonth() + 1; // Convert to 1-based month

          // Create a pattern to look for - we'll match both the filename format and the Month name format
          const prevMonthPattern1 = `${prevYear}-${prevMonth
            .toString()
            .padStart(2, "0")}`; // e.g., "2025-01"
          const prevMonthPattern2 = `${prevYear}-${
            months[prevDate.getMonth()]
          }`; // e.g., "2025-Enero"

          // Try to find the previous month reading by matching patterns
          let prevReading = null;
          let prevReadingKey = null;

          // First, try exact patterns
          for (const [key, value] of Object.entries(meter.readings)) {
            if (key === "ID" || key === "ADDRESS") continue;

            if (
              key.startsWith(prevMonthPattern1) ||
              key === prevMonthPattern2
            ) {
              prevReading = value;
              prevReadingKey = key;
              break;
            }
          }

          // If not found, try a more flexible approach for the date format files
          if (prevReading === null) {
            const readingsArray = Object.entries(meter.readings)
              .filter(([key]) => key !== "ID" && key !== "ADDRESS")
              .map(([key, value]) => ({
                key,
                value,
                date: new Date(key.split("T")[0]),
              }))
              .sort((a, b) => b.date.getTime() - a.date.getTime()); // Sort by date desc

            // Find the most recent reading that's before or equal to the previous month
            for (const reading of readingsArray) {
              const readingYear = reading.date.getFullYear();
              const readingMonth = reading.date.getMonth();

              const isPrevMonthOrBefore =
                readingYear < prevYear ||
                (readingYear === prevYear &&
                  readingMonth <= prevDate.getMonth());

              if (isPrevMonthOrBefore) {
                prevReading = reading.value;
                prevReadingKey = reading.key;
                break;
              }
            }
          }

          // Now calculate consumption with the found value
          if (prevReading !== null) {
            const previousReading = parseFloat(String(prevReading || "0"));
            const consumption = parseFloat(
              (currentReading - previousReading).toFixed(1)
            );

            // Store the calculated value
            currentConsumptionRef.current = consumption;
          } else {
            currentConsumptionRef.current = null;
          }
        } else {
          currentConsumptionRef.current = null;
        }
      } catch (e) {
        currentConsumptionRef.current = null;
      }
    } else {
      currentConsumptionRef.current = null;
    }
  };

  // Estimate the next reading
  const suggestedReading = useMemo(() => {
    if (meter.estimatedReading === null) return "";
    return Math.round(meter.estimatedReading).toString();
  }, [meter.estimatedReading]);

  // Add this useEffect to monitor for pending navigation
  useEffect(() => {
    if (pendingNavigation) {
      setIsNavigationDialogOpen(true);
    }
  }, [pendingNavigation]);

  // Simplify navigation handling
  const handleNavigation = (type: string, navigationAction: () => void) => {
    setNavigationType(type);

    // If there's a reading but it's not confirmed, show dialog
    if (inputValue && !localIsConfirmed) {
      setIsNavigationDialogOpen(true);
      setNavigationHandledByChild(true);
      setPendingNavigation(() => navigationAction);
    } else {
      // No unconfirmed reading, just navigate
      navigationAction();
    }
  };

  const handleConfirmAndNavigate = async () => {
    // First update the local state
    setLocalIsConfirmed(true);

    // Close the dialog
    setIsNavigationDialogOpen(false);

    // Update the parent state directly
    if (onConfirmationChange) {
      onConfirmationChange(meter.ID.toString(), true);
    }

    // Store in localStorage immediately
    localStorage.setItem(confirmedKey, "true");

    // Use a small timeout to allow state to propagate
    setTimeout(() => {
      if (pendingNavigation) {
        // Execute the stored navigation action directly
        pendingNavigation();
        // Reset the navigation state
        setPendingNavigation(null);
        setNavigationHandledByChild(false);
      }
    }, 50);
  };

  const handleLeaveUnconfirmed = () => {
    // Close the dialog
    setIsNavigationDialogOpen(false);

    // Store a reference to the current pending navigation
    const currentNavigation = pendingNavigation;

    // Reset the navigation state
    setPendingNavigation(null);
    setNavigationHandledByChild(false);

    // Execute navigation directly
    if (currentNavigation) {
      currentNavigation();
    }
  };

  const handleCancelNavigation = () => {
    // Close the dialog
    setIsNavigationDialogOpen(false);

    // Reset the navigation state
    setPendingNavigation(null);
    setNavigationHandledByChild(false);
  };

  // Handle customer interaction response
  const handleAnsweredDoorChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const answeredDoor = event.target.value === "yes";
    setVerificationData({
      ...verificationData,
      answeredDoor,
    });
  };

  // Handle water issues response
  const handleWaterIssuesChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const hadIssues = event.target.value === "yes";
    setVerificationData({
      ...verificationData,
      hadIssues,
    });
  };

  // Handle house inhabited response
  const handleHouseInhabitedChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const looksLivedIn = event.target.value === "yes";
    setVerificationData({
      ...verificationData,
      looksLivedIn,
    });
  };

  // Handle issue description change
  const handleIssueDescriptionChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setVerificationData({
      ...verificationData,
      issueDescription: event.target.value,
    });
  };

  // Handle residence months change
  const handleResidenceMonthsChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setVerificationData({
      ...verificationData,
      residenceMonths: event.target.value,
    });
  };

  // Update the handleCompleteVerification function
  const handleCompleteVerification = () => {
    // Store verification data
    const verificationInfo = {
      type: "lowConsumption",
      details: verificationData,
      consumption: currentConsumptionRef.current,
      currentReading: inputValue,
      previousReading:
        previousReadingEntries.length > 0
          ? previousReadingEntries[0].value
          : "0",
      previousReadingDate:
        previousReadingEntries.length > 0
          ? previousReadingEntries[0].key
          : null,
      timestamp: new Date().toISOString(),
    };

    // Save to localStorage
    localStorage.setItem(
      `meter_${meter.ID}_verification`,
      JSON.stringify(verificationInfo)
    );

    // Close dialog and confirm the reading
    setShowLowConsumptionDialog(false);
    setLocalIsConfirmed(true);
    localStorage.setItem(confirmedKey, "true");
    onConfirmationChange(meter.ID, true);
  };

  // Add this to the beginning of the component to restore verification state
  useEffect(() => {
    // Restore verification states from localStorage on mount or meter change
    const verificationData = localStorage.getItem(
      `meter_${meter.ID}_verification`
    );

    if (verificationData) {
      try {
        const parsedData = JSON.parse(verificationData) as VerificationData;

        // Determine if we need to restore any validation state
        if (parsedData.type === "highConsumption" && !parsedData.resolved) {
          setLocalIsConfirmed(true);
        }

        if (parsedData.type === "lowConsumption" && !parsedData.resolved) {
          // Restore the low consumption verification dialog state
          if (parsedData.details) {
            setLocalIsConfirmed(true);
          }
        }

        if (parsedData.type === "negativeConsumption" && !parsedData.resolved) {
          setLocalIsConfirmed(true);
        }
      } catch (e) {
        console.error("Error restoring verification data:", e);
      }
    }
  }, [meter.ID]);

  // Update the handleConfirmClick function to check for high consumption
  const handleConfirmClick = () => {
    // Calculate consumption here instead of using the ref
    let consumption = null;

    try {
      if (inputValue && meter.readings) {
        const currentReading = parseFloat(inputValue);
        if (!isNaN(currentReading)) {
          // Use our utility to find the previous month's reading
          const { key, reading } = findPreviousMonthReading(
            meter.readings,
            selectedMonth,
            selectedYear
          );

          if (reading !== null) {
            const previousReading = parseFloat(String(reading || "0"));
            consumption = parseFloat(
              (currentReading - previousReading).toFixed(1)
            );
          } else {
            // Fallback to using the most recent reading in previousEntries
            if (previousReadingEntries.length > 0) {
              const lastReadingEntry = previousReadingEntries[0];
              const fallbackReading = parseFloat(
                String(lastReadingEntry.value || "0")
              );
              consumption = parseFloat(
                (currentReading - fallbackReading).toFixed(1)
              );
            }
          }
        }
      }
    } catch (e) {
      // Silent catch
    }

    // Store the value for later use
    currentConsumptionRef.current = consumption;

    // Check if this is a negative consumption case
    if (consumption !== null && consumption < 0) {
      // Show negative consumption verification dialog
      setShowNegativeConsumptionDialog(true);
      return;
    }

    // Check if this is a high consumption case (> 1.6 * averageConsumption)
    if (
      consumption !== null &&
      averageConsumption > 0 &&
      consumption > averageConsumption * 1.6
    ) {
      // Show high consumption verification dialog
      setShowHighConsumptionDialog(true);
      return;
    }

    // Check if this is a low consumption case (>= 0 and < 4)
    if (consumption !== null && consumption >= 0 && consumption < 4) {
      // Check if we already have verification data
      const storedVerification = localStorage.getItem(
        `meter_${meter.ID}_verification`
      );

      if (storedVerification) {
        // If we already verified this meter, just confirm normally
        setLocalIsConfirmed(true);
        localStorage.setItem(confirmedKey, "true");
        onConfirmationChange(meter.ID, true);
      } else {
        // Show low consumption verification dialog
        setVerificationStep(1);
        setVerificationData({});
        setShowLowConsumptionDialog(true);
      }
    } else {
      // Normal confirmation without validation needed
      setLocalIsConfirmed(true);
      localStorage.setItem(confirmedKey, "true");
      onConfirmationChange(meter.ID, true);
    }
  };

  // Add these handlers if they're missing
  const handleCancelLowConsumptionDialog = () => {
    setShowLowConsumptionDialog(false);
    setVerificationStep(1);
    setVerificationData({});
  };

  // Handle confirming the low reading is correct
  const handleConfirmLowReading = () => {
    // Move to the next step to collect more information
    setVerificationStep(2);
  };

  // Update the handleUnconfirmClick function to clear verification data
  const handleUnconfirmClick = () => {
    // Update local state
    setLocalIsConfirmed(false);

    // Update parent state
    onConfirmationChange(meter.ID, false);

    // Update localStorage
    localStorage.removeItem(confirmedKey);

    // Also remove verification data from localStorage
    localStorage.removeItem(`meter_${meter.ID}_verification`);
  };

  // Add these handler functions:
  const handleUnconfirmButtonClick = () => {
    // Show confirmation dialog instead of immediately unconfirming
    setShowUnconfirmDialog(true);
  };

  const handleCancelUnconfirm = () => {
    setShowUnconfirmDialog(false);
  };

  const handleConfirmUnconfirm = () => {
    // Close the dialog
    setShowUnconfirmDialog(false);

    // Proceed with unconfirming
    setLocalIsConfirmed(false);

    // Update parent state
    onConfirmationChange(meter.ID, false);

    // Update localStorage
    localStorage.removeItem(confirmedKey);

    // Also remove verification data from localStorage
    localStorage.removeItem(`meter_${meter.ID}_verification`);
  };

  // Find this function or similar in the component
  const formatConsumption = () => {
    if (!inputValue || !previousReadingEntries.length) return "---";

    try {
      // Use the first entry (most recent), not the last entry
      const previousValue = previousReadingEntries[0]?.value || 0;
      const current = parseFloat(inputValue);
      const previous = parseFloat(String(previousValue));

      if (isNaN(current) || isNaN(previous)) return "---";

      const difference = current - previous;
      return difference.toFixed(1);
    } catch (error) {
      console.error("Error calculating consumption:", error);
      return "---";
    }
  };

  // Update the renderHistoricalReadings function to handle placeholder entries
  const renderHistoricalReadings = () => {
    // Add detailed logging to debug the render process
    console.log(
      "Rendering historical readings:",
      historicalReadings,
      "hasPreviousReadings:",
      hasPreviousReadings
    );

    if (!historicalReadings || historicalReadings.length === 0) {
      return (
        <Typography variant="body2" color="text.secondary">
          No hay lecturas anteriores disponibles.
        </Typography>
      );
    }

    return (
      <Box sx={{ mt: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Lecturas Anteriores:
        </Typography>
        <List dense>
          {historicalReadings.map((item, index) => (
            <ListItem key={index} disablePadding>
              <ListItemText
                primary={`${item.date}: ${
                  item.isMissing ? "No hay datos" : `${item.value} m³`
                }`}
                primaryTypographyProps={{
                  variant: "body2",
                  style: {
                    fontWeight: index === 0 ? "bold" : "normal",
                    color: item.isMissing
                      ? theme.palette.text.secondary
                      : "inherit",
                  },
                }}
              />
            </ListItem>
          ))}
        </List>
      </Box>
    );
  };

  // Also update the dialog version
  const renderHistoricalReadingsInDialog = () => {
    if (!historicalReadings || historicalReadings.length === 0) {
      return (
        <Typography variant="body2" color="text.secondary">
          No hay lecturas anteriores disponibles.
        </Typography>
      );
    }

    return (
      <Box sx={{ mt: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Historial de Lecturas:
        </Typography>
        <List dense>
          {historicalReadings.map((item, index) => (
            <ListItem key={index} disablePadding>
              <ListItemText
                primary={`${item.date}: ${
                  item.isMissing ? "No hay datos" : `${item.value} m³`
                }`}
                primaryTypographyProps={{
                  variant: "body2",
                  style: {
                    fontWeight: index === 0 ? "bold" : "normal",
                    color: item.isMissing
                      ? theme.palette.text.secondary
                      : "inherit",
                  },
                }}
              />
            </ListItem>
          ))}
        </List>
      </Box>
    );
  };

  // Update the renderMeterInfo function or similar that displays the meter details
  const renderMeterInfo = () => {
    return (
      <Box sx={{ my: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" component="div">
              Detalles del Medidor:
            </Typography>
            <Typography variant="body2">ID: {meter.ID}</Typography>
            <Typography variant="body2">Dirección: {meter.ADDRESS}</Typography>
            {/* Add additional meter details here if available */}
          </Grid>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" component="div">
              Estimaciones:
            </Typography>
            <Typography variant="body2">
              Promedio de consumo:{" "}
              {averageConsumption > 0 ? `${averageConsumption} m³` : "---"}
            </Typography>
            <Typography variant="body2">
              Lectura estimada:{" "}
              {estimatedReading && estimatedReading !== "---"
                ? `${estimatedReading} m³`
                : "--- m³"}
            </Typography>
          </Grid>
        </Grid>
      </Box>
    );
  };

  // Also add console logging right before rendering to help debug
  useEffect(() => {
    console.log("Current estimatedReading value:", estimatedReading);
    console.log("Current averageConsumption value:", averageConsumption);
  }, [estimatedReading, averageConsumption]);

  // Add this right before the return statement in your component
  useEffect(() => {
    // Fallback calculation for estimated reading if it's not being set
    if (
      (!estimatedReading || estimatedReading === "---") &&
      previousReadingEntries.length > 0 &&
      averageConsumption > 0
    ) {
      // Use the most recent reading (index 0) since we sorted newest first
      const lastReading = previousReadingEntries[0].value;
      const manualEstimate = Math.round(lastReading + averageConsumption);

      console.log("Manual estimated reading calculation:");
      console.log("- Last reading:", lastReading);
      console.log("- Average consumption:", averageConsumption);
      console.log("- Calculated estimate:", manualEstimate);

      // Set the estimated reading explicitly
      setEstimatedReading(manualEstimate);
    }
  }, [previousReadingEntries, averageConsumption, estimatedReading]);

  // Add these handlers for negative consumption dialog
  const handleCancelNegativeConsumptionDialog = () => {
    setShowNegativeConsumptionDialog(false);
  };

  // Handle confirming the negative reading is correct
  const handleConfirmNegativeReading = () => {
    // Close the dialog
    setShowNegativeConsumptionDialog(false);

    // Proceed with confirming the reading
    setLocalIsConfirmed(true);
    localStorage.setItem(confirmedKey, "true");
    onConfirmationChange(meter.ID, true);
  };

  // Add these handlers for high consumption dialog
  const handleCancelHighConsumptionDialog = () => {
    setShowHighConsumptionDialog(false);
  };

  // Handle confirming the high consumption reading is correct
  const handleConfirmHighConsumption = () => {
    // Close the dialog
    setShowHighConsumptionDialog(false);

    // Proceed with confirming the reading
    setLocalIsConfirmed(true);
    localStorage.setItem(confirmedKey, "true");
    onConfirmationChange(meter.ID, true);
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      {/* Navigation Pills */}

      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 3 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            backgroundColor: alpha(theme.palette.primary.main, 0.1),
            borderRadius: 2,
            px: 2,
            py: 0.75,
          }}
        >
          <HomeOutlinedIcon
            fontSize="small"
            sx={{ color: theme.palette.primary.main, mr: 1 }}
          />

          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            Medidor {currentIndex + 1} de {totalMeters}
          </Typography>
        </Box>

        {/* Main Card */}

        <Card
          elevation={2}
          sx={{
            mb: 4,
            borderRadius: 2,
            overflow: "visible",
            boxShadow: "0 4px 20px rgba(0,0,0,0.05)",
          }}
        >
          <CardContent sx={{ p: 0 }}>
            {/* Header Section */}

            <Box
              sx={{
                p: 3,
                pb: 2,
                background: `linear-gradient(to right, ${
                  theme.palette.primary.main
                }, ${alpha(theme.palette.primary.main, 0.8)})`,
                color: "white",
                borderTopLeftRadius: 4,
                borderTopRightRadius: 4,
              }}
            >
              <Typography
                variant="h5"
                fontWeight="600"
                sx={{ letterSpacing: 0.5 }}
              >
                #{meter.ID}
              </Typography>

              <Typography variant="body1" sx={{ mt: 1, opacity: 0.9 }}>
                {meter.ADDRESS}
              </Typography>
            </Box>

            {/* Content Section */}

            <Box sx={{ p: 3 }}>
              {/* Previous Readings Section */}

              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle1" fontWeight="600" sx={{ mb: 2 }}>
                  Lecturas Anteriores
                </Typography>

                {renderHistoricalReadings()}
              </Box>

              {/* Consumption Summary - Now with only 2 boxes */}

              <Box sx={{ mt: 3, mb: 3 }}>
                <Typography variant="subtitle1" fontWeight="600" sx={{ mb: 2 }}>
                  Resumen de Consumo
                </Typography>

                <Grid container spacing={2}>
                  {/* Promedio de Consumo - renamed */}

                  <Grid item xs={6}>
                    <Box
                      sx={{
                        borderRadius: 1,
                        p: 1.5,
                        backgroundColor: alpha(theme.palette.info.main, 0.08),
                        border: `1px solid ${alpha(
                          theme.palette.info.main,
                          0.15
                        )}`,
                        height: "100%",
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{
                          display: "block",
                          fontWeight: 500,
                          color: "text.secondary",
                          mb: 0.5,
                        }}
                      >
                        Promedio de Consumo
                      </Typography>

                      <Typography
                        variant="body1"
                        fontWeight={600}
                        color="info.main"
                      >
                        {averageConsumption.toFixed(1) || "---"} m³
                      </Typography>
                    </Box>
                  </Grid>

                  {/* Lectura Estimada - renamed */}

                  <Grid item xs={6}>
                    <Box
                      sx={{
                        borderRadius: 1,
                        p: 1.5,
                        backgroundColor: alpha(
                          theme.palette.warning.main,
                          0.08
                        ),
                        border: `1px solid ${alpha(
                          theme.palette.warning.main,
                          0.15
                        )}`,
                        height: "100%",
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{
                          display: "block",
                          fontWeight: 500,
                          color: "text.secondary",
                          mb: 0.5,
                        }}
                      >
                        Lectura Estimada
                      </Typography>

                      <Typography
                        variant="body1"
                        fontWeight={600}
                        color="warning.main"
                      >
                        {estimatedReading && estimatedReading !== "---"
                          ? `${estimatedReading} m³`
                          : "--- m³"}
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              </Box>

              <Divider sx={{ my: 3 }} />

              {/* Current Reading Section */}

              <Box>
                <Typography variant="subtitle1" fontWeight="600" sx={{ mb: 2 }}>
                  Lectura Actual
                </Typography>

                <TextField
                  key={`meter-reading-${meter.ID}`}
                  fullWidth
                  label="Lectura del medidor"
                  placeholder="Ingrese lectura"
                  variant="outlined"
                  type="number"
                  value={inputValue}
                  onChange={handleInputChange}
                  onKeyDown={(e) => {
                    // Handle Enter key press
                    if (e.key === "Enter" && inputValue && !localIsConfirmed) {
                      e.preventDefault(); // Prevent form submission if inside a form
                      handleConfirmClick();
                    }
                  }}
                  disabled={localIsConfirmed}
                  InputProps={{
                    endAdornment: <span style={{ marginLeft: "4px" }}>m³</span>,
                    sx: {
                      fontSize: "1.1rem",
                      fontWeight: 500,
                      backgroundColor: localIsConfirmed
                        ? alpha("#f5f5f5", 0.8)
                        : "white",
                      opacity: localIsConfirmed ? 0.8 : 1,
                      "& input": {
                        color: "text.primary",
                        WebkitTextFillColor: localIsConfirmed
                          ? "rgba(0, 0, 0, 0.7) !important"
                          : undefined,
                        fontWeight: localIsConfirmed ? 600 : 500,
                      },
                    },
                  }}
                  sx={{
                    mb: 2,
                    "& .MuiOutlinedInput-root": {
                      bgcolor: localIsConfirmed
                        ? alpha("#f5f5f5", 0.8)
                        : "white",
                      borderRadius: 1,
                    },
                    "& .MuiInputLabel-root": {
                      color: localIsConfirmed ? "text.secondary" : undefined,
                    },
                    "& .Mui-disabled": {
                      opacity: "0.9 !important",
                      color: "text.primary !important",
                      WebkitTextFillColor: "rgba(0, 0, 0, 0.8) !important",
                    },
                  }}
                />

                {/* Move Consumo Actual here - just after the TextField and before the confirm button */}

                {inputValue &&
                  previousReadingEntries.length > 0 &&
                  previousReadingEntries[0]?.value && (
                    <Box
                      sx={{
                        mb: 2.5,
                        p: 1.5,
                        border: "1px solid",
                        borderColor: (consumption) => {
                          const consumptionValue =
                            parseFloat(inputValue) -
                            parseFloat(
                              String(previousReadingEntries[0]?.value || "0")
                            );

                          if (consumptionValue > 0)
                            return alpha(theme.palette.success.main, 0.15);

                          if (consumptionValue < 0)
                            return alpha(theme.palette.error.main, 0.15);

                          return alpha(theme.palette.grey[500], 0.15); // For zero
                        },

                        backgroundColor: (consumption) => {
                          const consumptionValue =
                            parseFloat(inputValue) -
                            parseFloat(
                              String(previousReadingEntries[0]?.value || "0")
                            );

                          if (consumptionValue > 0)
                            return alpha(theme.palette.success.main, 0.05);

                          if (consumptionValue < 0)
                            return alpha(theme.palette.error.main, 0.05);

                          return alpha(theme.palette.grey[500], 0.05); // For zero
                        },

                        borderRadius: 1,
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{
                          display: "block",
                          fontWeight: 500,
                          color: "text.secondary",
                          mb: 0.5,
                        }}
                      >
                        Consumo Actual
                      </Typography>

                      <Typography
                        variant="body1"
                        fontWeight={600}
                        sx={{
                          fontSize: "1.1rem",
                          color: () => {
                            const consumptionValue =
                              parseFloat(inputValue) -
                              parseFloat(
                                String(previousReadingEntries[0]?.value || "0")
                              );

                            if (consumptionValue > 0)
                              return theme.palette.success.main;

                            if (consumptionValue < 0)
                              return theme.palette.error.main;

                            return theme.palette.grey[600]; // For zero
                          },
                        }}
                      >
                        {formatConsumption()} m³
                      </Typography>
                    </Box>
                  )}

                <Box sx={{ display: "flex", gap: 2, mt: 2 }}>
                  <Button
                    variant={localIsConfirmed ? "outlined" : "contained"}
                    color={localIsConfirmed ? "error" : "primary"}
                    onClick={() => {
                      if (localIsConfirmed) {
                        // Show confirmation dialog instead of immediately unconfirming
                        handleUnconfirmButtonClick();
                      } else {
                        // Confirm logic
                        handleConfirmClick();
                      }
                    }}
                    disabled={inputValue.trim() === ""}
                    startIcon={
                      localIsConfirmed ? (
                        <WarningIcon />
                      ) : (
                        <CheckCircleOutlineIcon />
                      )
                    }
                    sx={{ minWidth: 120 }}
                  >
                    {localIsConfirmed ? "Desconfirmar" : "Confirmar"}
                  </Button>
                </Box>
              </Box>
            </Box>
          </CardContent>
        </Card>

        {/* Navigation Buttons */}

        <Box sx={{ display: "flex", mt: 3, gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={() => handleNavigation("prev", onPrev)}
            disabled={currentIndex === 0}
            sx={{ flexGrow: 1 }}
          >
            Anterior
          </Button>

          <Button
            variant="outlined"
            startIcon={<HomeOutlinedIcon />}
            onClick={() => handleNavigation("home", onHome)}
            sx={{ flexGrow: 1 }}
          >
            Inicio
          </Button>

          {currentIndex < totalMeters - 1 ? (
            <Button
              variant="contained"
              endIcon={<ArrowForwardIcon />}
              onClick={() => handleNavigation("next", onNext)}
              sx={{ flexGrow: 1 }}
            >
              Siguiente
            </Button>
          ) : (
            <Button
              variant="contained"
              color="success"
              onClick={() => handleNavigation("finish", onFinish)}
              sx={{ flexGrow: 1 }}
            >
              Finalizar
            </Button>
          )}
        </Box>

        {/* Navigation Warning Dialog */}
        <Dialog
          open={isNavigationDialogOpen}
          onClose={handleCancelNavigation}
          aria-labelledby="navigation-dialog-title"
          aria-describedby="navigation-dialog-description"
          PaperProps={{
            sx: {
              borderRadius: 2,
              boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
              overflow: "hidden",
              maxWidth: 500,
            },
          }}
        >
          <DialogTitle
            id="navigation-dialog-title"
            sx={{
              borderBottom: 1,
              borderColor: "divider",
              backgroundColor: alpha(theme.palette.warning.light, 0.05),
              px: 3,
              py: 2.5,
              "& .MuiTypography-root": {
                fontSize: "1.25rem",
                fontWeight: 600,
              },
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <WarningAmberIcon color="warning" />
              <Typography>Lectura sin confirmar</Typography>
            </Box>
          </DialogTitle>
          <DialogContent sx={{ p: 3, pt: 3 }}>
            <DialogContentText
              id="navigation-dialog-description"
              sx={{
                mb: 2,
                color: "text.primary",
                fontSize: "1rem",
              }}
            >
              Ha ingresado una lectura pero no la ha confirmado. ¿Qué desea
              hacer?
            </DialogContentText>
          </DialogContent>
          <DialogActions
            sx={{
              px: 3,
              py: 2.5,
              gap: 1,
              borderTop: 1,
              borderColor: "divider",
            }}
          >
            <Button
              onClick={handleCancelNavigation}
              color="inherit"
              variant="outlined"
              sx={{ minWidth: 100 }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleLeaveUnconfirmed}
              color="warning"
              variant="outlined"
              sx={{ minWidth: 140 }}
            >
              Dejar sin confirmar
            </Button>
            <Button
              onClick={handleConfirmAndNavigate}
              color="success"
              variant="contained"
              sx={{ minWidth: 160 }}
            >
              Confirmar y continuar
            </Button>
          </DialogActions>
        </Dialog>

        {/* Low Consumption Verification Dialog */}
        <Dialog
          open={showLowConsumptionDialog}
          onClose={handleCancelLowConsumptionDialog}
          aria-labelledby="low-consumption-dialog-title"
          maxWidth="sm"
          fullWidth
        >
          {verificationStep === 1 && (
            <>
              <DialogTitle
                id="low-consumption-dialog-title"
                sx={{
                  borderBottom: 1,
                  borderColor: "divider",
                  backgroundColor: alpha(theme.palette.info.light, 0.1),
                  px: 3,
                  py: 2.5,
                  "& .MuiTypography-root": {
                    fontSize: "1.25rem",
                    fontWeight: 600,
                  },
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                  <InfoOutlinedIcon color="info" />
                  <Typography>Consumo Bajo Detectado</Typography>
                </Box>
              </DialogTitle>
              <DialogContent sx={{ px: 3, py: 3 }}>
                <Box sx={{ mb: 3 }}>
                  <Typography
                    variant="subtitle1"
                    sx={{ fontWeight: 600, mb: 1 }}
                  >
                    Resumen de la Lectura:
                  </Typography>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2,
                      backgroundColor: alpha(
                        theme.palette.background.default,
                        0.7
                      ),
                      border: 1,
                      borderColor: "divider",
                      borderRadius: 1,
                    }}
                  >
                    <Grid container spacing={2}>
                      <Grid item xs={6}>
                        <Typography variant="body2" color="text.secondary">
                          Lectura Anterior:
                        </Typography>
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>
                          {previousReadingEntries.length > 0
                            ? previousReadingEntries[0]?.value
                            : "---"}
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2" color="text.secondary">
                          Lectura Actual:
                        </Typography>
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>
                          {inputValue}
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2" color="text.secondary">
                          Consumo Promedio:
                        </Typography>
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>
                          {averageConsumption.toFixed(1)} m³
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2" color="text.secondary">
                          Consumo Calculado:
                        </Typography>
                        <Typography
                          variant="h6"
                          sx={{
                            fontWeight: 600,
                            color: theme.palette.info.dark,
                          }}
                        >
                          {currentConsumptionRef.current !== null
                            ? currentConsumptionRef.current
                            : "?"}{" "}
                          m³
                        </Typography>
                      </Grid>
                      <Grid item xs={12}>
                        <Divider sx={{ my: 1 }} />
                        <Box
                          sx={{ display: "flex", alignItems: "center", mt: 1 }}
                        >
                          <Typography variant="body2" sx={{ mr: 1 }}>
                            El consumo actual es{" "}
                            <Box component="span" sx={{ fontWeight: 600 }}>
                              muy bajo
                            </Box>
                          </Typography>
                          <Chip
                            label="Bajo"
                            color="info"
                            size="small"
                            sx={{
                              fontWeight: 600,
                              fontSize: "0.75rem",
                              height: 24,
                              ml: 1,
                            }}
                          />
                        </Box>
                      </Grid>
                    </Grid>
                  </Paper>
                </Box>

                <Alert
                  severity="info"
                  variant="outlined"
                  sx={{
                    mb: 3,
                    "& .MuiAlert-message": {
                      fontWeight: 500,
                    },
                  }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                    Se requiere verificación
                  </Typography>
                  <Typography variant="body2">
                    Debido al bajo consumo detectado, necesitamos verificar la
                    situación de esta propiedad. Por favor complete la siguiente
                    información.
                  </Typography>
                </Alert>

                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                  ¿Alguien atendió en la propiedad?
                </Typography>

                <Box
                  sx={{
                    p: 2,
                    border: 1,
                    borderColor: alpha(theme.palette.primary.main, 0.2),
                    borderRadius: 1,
                    backgroundColor: alpha(theme.palette.primary.main, 0.02),
                  }}
                >
                  <FormControl component="fieldset" sx={{ width: "100%" }}>
                    <RadioGroup
                      value={verificationData.answeredDoor ? "yes" : "no"}
                      onChange={handleAnsweredDoorChange}
                      sx={{ flexDirection: "row", gap: 4 }}
                    >
                      <FormControlLabel
                        value="yes"
                        control={<Radio color="primary" />}
                        label="Sí"
                        sx={{
                          "& .MuiFormControlLabel-label": {
                            fontWeight: 500,
                          },
                        }}
                      />
                      <FormControlLabel
                        value="no"
                        control={<Radio color="primary" />}
                        label="No"
                        sx={{
                          "& .MuiFormControlLabel-label": {
                            fontWeight: 500,
                          },
                        }}
                      />
                    </RadioGroup>
                  </FormControl>
                </Box>
              </DialogContent>

              <DialogActions
                sx={{
                  px: 3,
                  py: 2.5,
                  gap: 1,
                  borderTop: 1,
                  borderColor: "divider",
                }}
              >
                <Button
                  onClick={handleCancelLowConsumptionDialog}
                  color="inherit"
                  variant="outlined"
                  sx={{ minWidth: 100 }}
                >
                  Cancelar
                </Button>
                <Box sx={{ flex: 1 }} />
                <Button
                  onClick={() => setVerificationStep(2)}
                  color="primary"
                  variant="contained"
                  disabled={verificationData.answeredDoor === undefined}
                  startIcon={<ArrowForwardIcon />}
                  sx={{ minWidth: 140 }}
                >
                  Siguiente
                </Button>
              </DialogActions>
            </>
          )}

          {verificationStep === 2 && (
            <>
              <DialogTitle
                id="verification-dialog-title"
                sx={{
                  borderBottom: 1,
                  borderColor: "divider",
                  backgroundColor: alpha(theme.palette.info.light, 0.05),
                  px: 3,
                  py: 2.5,
                  "& .MuiTypography-root": {
                    fontSize: "1.25rem",
                    fontWeight: 600,
                  },
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                  <InfoOutlinedIcon color="info" />
                  <Typography>Verificación de Bajo Consumo</Typography>
                </Box>
              </DialogTitle>

              <DialogContent sx={{ px: 3, py: 3 }}>
                <Alert
                  severity="info"
                  sx={{
                    mb: 3,
                    "& .MuiAlert-message": {
                      fontWeight: 500,
                    },
                  }}
                >
                  Por favor verifique la situación en la residencia
                </Alert>

                <Box
                  sx={{
                    p: 2.5,
                    mb: 3,
                    border: 1,
                    borderColor: alpha(theme.palette.primary.main, 0.2),
                    borderRadius: 1,
                    backgroundColor: alpha(theme.palette.primary.main, 0.02),
                  }}
                >
                  <FormControl component="fieldset" sx={{ width: "100%" }}>
                    <FormLabel
                      component="legend"
                      sx={{
                        fontWeight: 600,
                        color: "primary.main",
                        mb: 1.5,
                        fontSize: "0.95rem",
                      }}
                    >
                      ¿Han tenido problemas con el agua?
                    </FormLabel>
                    <RadioGroup
                      value={verificationData.hadIssues ? "yes" : "no"}
                      onChange={handleWaterIssuesChange}
                      sx={{ flexDirection: "row", gap: 4 }}
                    >
                      <FormControlLabel
                        value="yes"
                        control={<Radio color="primary" />}
                        label="Sí"
                        sx={{
                          "& .MuiFormControlLabel-label": {
                            fontWeight: 500,
                          },
                        }}
                      />
                      <FormControlLabel
                        value="no"
                        control={<Radio color="primary" />}
                        label="No"
                        sx={{
                          "& .MuiFormControlLabel-label": {
                            fontWeight: 500,
                          },
                        }}
                      />
                    </RadioGroup>
                  </FormControl>
                </Box>

                {verificationData.answeredDoor && (
                  <Box sx={{ mb: 1 }}>
                    <Paper
                      elevation={0}
                      sx={{
                        p: 2.5,
                        mb: 3,
                        border: 1,
                        borderColor: alpha(theme.palette.primary.main, 0.2),
                        borderRadius: 1,
                        backgroundColor: alpha(
                          theme.palette.primary.main,
                          0.02
                        ),
                      }}
                    >
                      <FormControl
                        component="fieldset"
                        sx={{ width: "100%", mb: 3 }}
                      >
                        <FormLabel
                          component="legend"
                          sx={{
                            fontWeight: 600,
                            color: "primary.main",
                            mb: 1.5,
                            fontSize: "0.95rem",
                          }}
                        >
                          ¿Han tenido problemas con el agua?
                        </FormLabel>
                        <RadioGroup
                          value={verificationData.hadIssues ? "yes" : "no"}
                          onChange={handleWaterIssuesChange}
                          sx={{ flexDirection: "row", gap: 4 }}
                        >
                          <FormControlLabel
                            value="yes"
                            control={<Radio color="primary" />}
                            label="Sí"
                            sx={{
                              "& .MuiFormControlLabel-label": {
                                fontWeight: 500,
                              },
                            }}
                          />
                          <FormControlLabel
                            value="no"
                            control={<Radio color="primary" />}
                            label="No"
                            sx={{
                              "& .MuiFormControlLabel-label": {
                                fontWeight: 500,
                              },
                            }}
                          />
                        </RadioGroup>
                      </FormControl>

                      {verificationData.hadIssues && (
                        <TextField
                          fullWidth
                          variant="outlined"
                          margin="normal"
                          label="Descripción breve del problema"
                          value={verificationData.issueDescription || ""}
                          onChange={handleIssueDescriptionChange}
                          sx={{ mb: 3 }}
                        />
                      )}

                      <TextField
                        fullWidth
                        variant="outlined"
                        margin="normal"
                        label="¿Cuántos meses llevan viviendo aquí?"
                        type="number"
                        value={verificationData.residenceMonths || ""}
                        onChange={handleResidenceMonthsChange}
                        InputProps={{
                          inputProps: { min: 0 },
                          startAdornment: (
                            <InputAdornment position="start">
                              <AccessTimeIcon color="action" />
                            </InputAdornment>
                          ),
                        }}
                      />
                    </Paper>
                  </Box>
                )}

                {verificationData.answeredDoor === false && (
                  <Box sx={{ mb: 1 }}>
                    <Paper
                      elevation={0}
                      sx={{
                        p: 2.5,
                        border: 1,
                        borderColor: alpha(theme.palette.primary.main, 0.2),
                        borderRadius: 1,
                        backgroundColor: alpha(
                          theme.palette.primary.main,
                          0.02
                        ),
                      }}
                    >
                      <FormControl component="fieldset" sx={{ width: "100%" }}>
                        <FormLabel
                          component="legend"
                          sx={{
                            fontWeight: 600,
                            color: "primary.main",
                            mb: 1.5,
                            fontSize: "0.95rem",
                          }}
                        >
                          ¿La casa parece habitada?
                        </FormLabel>
                        <RadioGroup
                          value={verificationData.looksLivedIn ? "yes" : "no"}
                          onChange={handleHouseInhabitedChange}
                          sx={{ flexDirection: "row", gap: 4 }}
                        >
                          <FormControlLabel
                            value="yes"
                            control={<Radio color="primary" />}
                            label="Sí"
                            sx={{
                              "& .MuiFormControlLabel-label": {
                                fontWeight: 500,
                              },
                            }}
                          />
                          <FormControlLabel
                            value="no"
                            control={<Radio color="primary" />}
                            label="No"
                            sx={{
                              "& .MuiFormControlLabel-label": {
                                fontWeight: 500,
                              },
                            }}
                          />
                        </RadioGroup>
                      </FormControl>
                    </Paper>
                  </Box>
                )}
              </DialogContent>

              <DialogActions
                sx={{
                  px: 3,
                  py: 2.5,
                  gap: 1,
                  borderTop: 1,
                  borderColor: "divider",
                }}
              >
                <Button
                  onClick={() => setVerificationStep(1)}
                  color="inherit"
                  variant="outlined"
                  startIcon={<ArrowBackIcon />}
                  sx={{ minWidth: 100 }}
                >
                  Atrás
                </Button>
                <Box sx={{ flex: 1 }} />
                <Button
                  onClick={handleCompleteVerification}
                  color="primary"
                  variant="contained"
                  disabled={
                    verificationData.answeredDoor === undefined ||
                    (verificationData.answeredDoor === true &&
                      verificationData.hadIssues === undefined) ||
                    (verificationData.answeredDoor === true &&
                      !verificationData.residenceMonths) ||
                    (verificationData.answeredDoor === false &&
                      verificationData.looksLivedIn === undefined)
                  }
                  startIcon={<CheckCircleIcon />}
                  sx={{ minWidth: 200 }}
                >
                  Guardar y Confirmar
                </Button>
              </DialogActions>
            </>
          )}
        </Dialog>

        {/* Unconfirm Confirmation Dialog */}
        <Dialog
          open={showUnconfirmDialog}
          onClose={handleCancelUnconfirm}
          aria-labelledby="unconfirm-dialog-title"
          PaperProps={{
            sx: {
              borderRadius: 2,
              boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
              overflow: "hidden",
              maxWidth: 500,
            },
          }}
        >
          <DialogTitle
            id="unconfirm-dialog-title"
            sx={{
              borderBottom: 1,
              borderColor: "divider",
              backgroundColor: alpha(theme.palette.error.light, 0.05),
              px: 3,
              py: 2.5,
              "& .MuiTypography-root": {
                fontSize: "1.25rem",
                fontWeight: 600,
              },
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <WarningIcon color="error" />
              <Typography>¿Desconfirmar Lectura?</Typography>
            </Box>
          </DialogTitle>
          <DialogContent sx={{ p: 3, pt: 3 }}>
            <DialogContentText
              sx={{
                mb: 2,
                color: "text.primary",
                fontSize: "1rem",
              }}
              component="div"
            >
              Si desconfirma esta lectura, se perderán los datos de verificación
              y necesitará completar nuevamente la información de verificación
              si vuelve a confirmar la lectura.
            </DialogContentText>
            <Alert severity="warning" sx={{ mb: 1 }}>
              ¿Está seguro que desea desconfirmar la lectura?
            </Alert>
          </DialogContent>
          <DialogActions
            sx={{
              px: 3,
              py: 2.5,
              gap: 1,
              borderTop: 1,
              borderColor: "divider",
            }}
          >
            <Button
              onClick={handleCancelUnconfirm}
              color="inherit"
              variant="outlined"
              sx={{ minWidth: 100 }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmUnconfirm}
              color="error"
              variant="contained"
              sx={{ minWidth: 140 }}
              startIcon={<WarningIcon />}
            >
              Desconfirmar
            </Button>
          </DialogActions>
        </Dialog>

        {/* Negative Consumption Verification Dialog */}
        <Dialog
          open={showNegativeConsumptionDialog}
          onClose={handleCancelNegativeConsumptionDialog}
          aria-labelledby="negative-consumption-dialog-title"
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle
            id="negative-consumption-dialog-title"
            sx={{
              borderBottom: 1,
              borderColor: "divider",
              backgroundColor: alpha(theme.palette.error.light, 0.1),
              px: 3,
              py: 2.5,
              "& .MuiTypography-root": {
                fontSize: "1.25rem",
                fontWeight: 600,
              },
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <ErrorOutlineIcon color="error" />
              <Typography>Consumo Negativo Detectado</Typography>
            </Box>
          </DialogTitle>
          <DialogContent sx={{ px: 3, py: 3 }}>
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                Resumen de la Lectura:
              </Typography>
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  backgroundColor: alpha(theme.palette.background.default, 0.7),
                  border: 1,
                  borderColor: "divider",
                  borderRadius: 1,
                }}
              >
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Lectura Anterior:
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      {previousReadingEntries.length > 0
                        ? previousReadingEntries[0]?.value
                        : "---"}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Lectura Actual:
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      {inputValue}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Consumo Promedio:
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      {averageConsumption.toFixed(1)} m³
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Consumo Calculado:
                    </Typography>
                    <Typography
                      variant="h6"
                      sx={{ fontWeight: 600, color: theme.palette.error.dark }}
                    >
                      {currentConsumptionRef.current !== null
                        ? currentConsumptionRef.current
                        : "?"}{" "}
                      m³
                    </Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Divider sx={{ my: 1 }} />
                    <Box sx={{ display: "flex", alignItems: "center", mt: 1 }}>
                      <Typography variant="body2" sx={{ mr: 1 }}>
                        El consumo actual es{" "}
                        <Box
                          component="span"
                          sx={{
                            fontWeight: 600,
                            color: theme.palette.error.main,
                          }}
                        >
                          negativo
                        </Box>
                      </Typography>
                      <Chip
                        label="Negativo"
                        color="error"
                        size="small"
                        sx={{
                          fontWeight: 600,
                          fontSize: "0.75rem",
                          height: 24,
                          ml: 1,
                        }}
                      />
                    </Box>
                  </Grid>
                </Grid>
              </Paper>
            </Box>

            <Alert
              severity="error"
              variant="outlined"
              sx={{
                mb: 3,
                "& .MuiAlert-message": {
                  fontWeight: 500,
                },
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                Posibles causas de consumo negativo:
              </Typography>
              <List dense disablePadding sx={{ mt: 0.5 }}>
                <ListItem sx={{ py: 0.5 }}>
                  <ListItemText primary="• Error al ingresar la lectura actual" />
                </ListItem>
                <ListItem sx={{ py: 0.5 }}>
                  <ListItemText primary="• Lectura anterior fue una estimación alta" />
                </ListItem>
                <ListItem sx={{ py: 0.5 }}>
                  <ListItemText primary="• Reemplazo o reinicio del medidor" />
                </ListItem>
              </List>
            </Alert>

            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
              ¿Desea continuar?
            </Typography>
            <Typography variant="body2">
              Si está seguro que la lectura actual ({inputValue}) es correcta,
              puede confirmarla. De lo contrario, regrese para corregir el
              valor.
            </Typography>
          </DialogContent>
          <DialogActions
            sx={{
              px: 3,
              py: 2.5,
              gap: 1,
              borderTop: 1,
              borderColor: "divider",
            }}
          >
            <Button
              onClick={handleCancelNegativeConsumptionDialog}
              color="inherit"
              variant="outlined"
              sx={{ minWidth: 140 }}
            >
              Cancelar y Editar
            </Button>
            <Button
              onClick={handleConfirmNegativeReading}
              color="error"
              variant="contained"
              sx={{ minWidth: 140 }}
              startIcon={<CheckCircleIcon />}
            >
              Confirmar Lectura
            </Button>
          </DialogActions>
        </Dialog>

        {/* High Consumption Verification Dialog */}
        <Dialog
          open={showHighConsumptionDialog}
          onClose={handleCancelHighConsumptionDialog}
          aria-labelledby="high-consumption-dialog-title"
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle
            id="high-consumption-dialog-title"
            sx={{
              borderBottom: 1,
              borderColor: "divider",
              backgroundColor: alpha(theme.palette.warning.light, 0.1),
              px: 3,
              py: 2.5,
              "& .MuiTypography-root": {
                fontSize: "1.25rem",
                fontWeight: 600,
              },
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <WarningAmberIcon color="warning" />
              <Typography>Consumo Elevado Detectado</Typography>
            </Box>
          </DialogTitle>
          <DialogContent sx={{ px: 3, py: 3 }}>
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                Resumen de la Lectura:
              </Typography>
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  backgroundColor: alpha(theme.palette.background.default, 0.7),
                  border: 1,
                  borderColor: "divider",
                  borderRadius: 1,
                }}
              >
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Lectura Anterior:
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      {previousReadingEntries.length > 0
                        ? previousReadingEntries[0]?.value
                        : "---"}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Lectura Actual:
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      {inputValue}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Consumo Promedio:
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      {averageConsumption.toFixed(1)} m³
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Consumo Calculado:
                    </Typography>
                    <Typography
                      variant="h6"
                      sx={{
                        fontWeight: 600,
                        color: theme.palette.warning.dark,
                      }}
                    >
                      {currentConsumptionRef.current !== null
                        ? currentConsumptionRef.current
                        : "?"}{" "}
                      m³
                    </Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Divider sx={{ my: 1 }} />
                    <Box sx={{ display: "flex", alignItems: "center", mt: 1 }}>
                      <Typography variant="body2" sx={{ mr: 1 }}>
                        El consumo actual es{" "}
                        <Box component="span" sx={{ fontWeight: 600 }}>
                          {currentConsumptionRef.current !== null &&
                          averageConsumption > 0
                            ? (
                                currentConsumptionRef.current /
                                averageConsumption
                              ).toFixed(1)
                            : "?"}{" "}
                          veces
                        </Box>{" "}
                        mayor que el promedio
                      </Typography>
                      <Chip
                        label="Alto"
                        color="warning"
                        size="small"
                        sx={{
                          fontWeight: 600,
                          fontSize: "0.75rem",
                          height: 24,
                          ml: 1,
                        }}
                      />
                    </Box>
                  </Grid>
                </Grid>
              </Paper>
            </Box>

            <Alert
              severity="warning"
              variant="outlined"
              sx={{
                mb: 3,
                "& .MuiAlert-message": {
                  fontWeight: 500,
                },
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                Posibles causas de consumo elevado:
              </Typography>
              <Typography variant="body2">
                Si está seguro que la lectura actual ({inputValue}) es correcta,
                puede confirmarla. De lo contrario, regrese para corregir el
                valor.
              </Typography>
            </Alert>

            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
              ¿Desea continuar?
            </Typography>
            <Typography variant="body2">
              Si está seguro que la lectura actual ({inputValue}) es correcta,
              puede confirmarla. De lo contrario, regrese para corregir el
              valor.
            </Typography>
          </DialogContent>
          <DialogActions
            sx={{
              px: 3,
              py: 2.5,
              gap: 1,
              borderTop: 1,
              borderColor: "divider",
            }}
          >
            <Button
              onClick={handleCancelHighConsumptionDialog}
              color="inherit"
              variant="outlined"
              sx={{ minWidth: 140 }}
            >
              Cancelar y Editar
            </Button>
            <Button
              onClick={handleConfirmHighConsumption}
              color="warning"
              variant="contained"
              sx={{ minWidth: 140 }}
              startIcon={<CheckCircleIcon />}
            >
              Confirmar Lectura
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Container>
  );
}

export default MeterScreen;

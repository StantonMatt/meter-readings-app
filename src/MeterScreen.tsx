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
  const [navigationType, setNavigationType] = useState<
    "prev" | "next" | "home" | "other" | "none"
  >("none");

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

  // Add these new state variables near your other dialog state variables
  const [showCantReadDialog, setShowCantReadDialog] = useState<boolean>(false);
  const [cantReadReason, setCantReadReason] = useState<string>("");
  const [otherReasonText, setOtherReasonText] = useState<string>("");

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

  // Add this near the top of your component, with other state variables
  const [isDataLoaded, setIsDataLoaded] = useState<boolean>(false);

  // Then modify your useEffect for fetching data:

  useEffect(() => {
    let isMounted = true;

    // Reset states when meter changes to prevent showing stale data
    if (!isDataLoaded) {
      setPreviousReadingEntries([]);
      setHistoricalReadings([]);
      setHasPreviousReadings(false);
      setPreviousReading(null);
      setAverageConsumption(0);
      setEstimatedReading(0);
    }

    // Create a unique request ID for this meter/route combination
    const requestId = `meter_${meter.ID}_route_${routeId}_request`;

    const fetchPreviousReadings = async () => {
      // Clear the fetched flag for this meter when we're explicitly fetching
      delete hasFetchedRef.current[meter.ID];

      // Reset data loaded flag
      setIsDataLoaded(false);

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

        // Make sure we're only processing readings for THIS meter
        if (
          response &&
          response.readings &&
          response.ID.toString() === meter.ID.toString()
        ) {
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
          console.log(
            `Filtered entries for meter ${meter.ID}:`,
            filteredEntries
          );

          // Calculate average consumption from available readings
          const validEntries = entries.filter(
            (entry) => typeof entry.value === "number"
          );

          // Log all entries with their dates for debugging
          console.log(
            `All valid entries for meter ${meter.ID} before sorting:`,
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
            `Sorted entries for meter ${meter.ID} (oldest to newest):`,
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
                `Consumption for meter ${meter.ID} ${validEntries[i].date} to ${
                  validEntries[i + 1].date
                }: ${diff}`
              );
              consumptionValues.push(diff);
            } else {
              console.log(
                `Skipping negative/zero consumption for meter ${meter.ID} ${
                  validEntries[i].date
                } to ${validEntries[i + 1].date}: ${diff}`
              );
            }
          }

          // Calculate average consumption
          console.log(
            `Consumption values used for average for meter ${meter.ID}:`,
            consumptionValues
          );
          let avgConsumption = 0;
          if (consumptionValues.length > 0) {
            const sum = consumptionValues.reduce((acc, val) => acc + val, 0);
            console.log(
              `Sum of consumption values for meter ${meter.ID}:`,
              sum
            );
            console.log(
              `Number of consumption values for meter ${meter.ID}:`,
              consumptionValues.length
            );

            avgConsumption = sum / consumptionValues.length;
            avgConsumption = Math.round(avgConsumption * 10) / 10;
            console.log(
              `Final average consumption for meter ${meter.ID}:`,
              avgConsumption
            );
          }

          // Calculate the estimated reading with correct business logic
          let estimatedValue: number | string = "---";
          if (validEntries.length > 0 && avgConsumption > 0) {
            // Get the most recent reading (last month's reading)
            const mostRecentEntry = validEntries[validEntries.length - 1];

            // Now calculate the estimated reading - simply last reading + average consumption
            const baseReading = mostRecentEntry.value;
            const estimatedNumber = Math.round(baseReading + avgConsumption);
            estimatedValue = estimatedNumber;

            console.log(`Base reading for meter ${meter.ID}:`, baseReading);
            console.log(
              `Average consumption for meter ${meter.ID}:`,
              avgConsumption
            );
            console.log(
              `FORMULA for meter ${meter.ID}:`,
              `${baseReading} + ${avgConsumption} = ${estimatedNumber}`
            );
          }

          // Update UI elements
          if (filteredEntries.length > 0) {
            setPreviousReadingEntries(filteredEntries);
            setHistoricalReadings(filteredEntries);
            setHasPreviousReadings(true);

            // Store the most recent reading for consumption calculations
            if (validEntries.length > 0) {
              setPreviousReading(validEntries[validEntries.length - 1].value);
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

        // Mark data as loaded
        setIsDataLoaded(true);
      } catch (error) {
        console.error(
          `Error fetching previous readings for meter ${meter.ID}:`,
          error
        );
        setHasPreviousReadings(false);
        setIsDataLoaded(true);
      } finally {
        // Clean up the request flag when done
        delete (window as any)[requestId];
      }
    };

    // Always fetch when the meter changes
    fetchPreviousReadings();

    return () => {
      isMounted = false;
      // Clean up the request flag when component unmounts
      delete (window as any)[requestId];
    };
  }, [meter.ID, routeId, selectedMonth, selectedYear]);

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
    setNavigationType(type as "prev" | "next" | "home" | "other" | "none");

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
    // Instead of directly confirming, we'll use the same validation logic from handleConfirmClick
    // to check if we need to show any validation dialogs first

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

    // Close the navigation dialog first
    setIsNavigationDialogOpen(false);

    // Check if this is a negative consumption case
    if (consumption !== null && consumption < 0) {
      // Show negative consumption verification dialog
      setShowNegativeConsumptionDialog(true);
      // Store the pending navigation to execute after validation
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
        confirmAndNavigate();
      } else {
        // Show low consumption verification dialog
        setVerificationStep(1);
        setVerificationData({});
        setShowLowConsumptionDialog(true);
      }
    } else {
      // Normal confirmation without validation needed
      confirmAndNavigate();
    }
  };

  // Add this helper function to handle the actual confirmation and navigation
  const confirmAndNavigate = () => {
    // Update the local state
    setLocalIsConfirmed(true);

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
  const handleAnsweredDoorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setVerificationData({
      ...verificationData,
      answeredDoor: value === "yes",
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

    // Use the confirmAndNavigate helper
    confirmAndNavigate();
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
    // Reset pending navigation since we're canceling
    setPendingNavigation(null);
    setNavigationHandledByChild(false);
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
    // Reset pending navigation since we're canceling
    setPendingNavigation(null);
    setNavigationHandledByChild(false);
  };

  // Handle confirming the negative reading is correct
  const handleConfirmNegativeReading = () => {
    // Close the dialog
    setShowNegativeConsumptionDialog(false);

    // Proceed with confirming the reading
    confirmAndNavigate();
  };

  // Add these handlers for high consumption dialog
  const handleCancelHighConsumptionDialog = () => {
    setShowHighConsumptionDialog(false);
    // Reset pending navigation since we're canceling
    setPendingNavigation(null);
    setNavigationHandledByChild(false);
  };

  // Handle confirming the high consumption reading is correct
  const handleConfirmHighConsumption = () => {
    // Close the dialog
    setShowHighConsumptionDialog(false);

    // Proceed with confirming the reading
    confirmAndNavigate();
  };

  // Add this handler function for the "Can't Read Meter" button
  const handleCantReadMeter = () => {
    // Reset the form state
    setCantReadReason("");
    setOtherReasonText("");
    // Open the dialog
    setShowCantReadDialog(true);
  };

  // Handler for reason selection
  const handleReasonChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setCantReadReason(event.target.value);
  };

  // Handler for "other" reason text input
  const handleOtherReasonChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setOtherReasonText(event.target.value);
  };

  // Handler for confirming the estimated reading
  const handleConfirmEstimatedReading = () => {
    // Create verification data
    const verificationInfo = {
      type: "cantRead",
      details: {
        reason: cantReadReason,
        otherReason: cantReadReason === "other" ? otherReasonText : "",
        estimatedReading: estimatedReading,
      },
      timestamp: new Date().toISOString(),
    };

    // Save to localStorage
    localStorage.setItem(
      `meter_${meter.ID}_verification`,
      JSON.stringify(verificationInfo)
    );

    // Set the input value to the estimated reading
    const estimatedValue = estimatedReading.toString();
    setInputValue(estimatedValue);
    onReadingChange(meter.ID, estimatedValue);
    localStorage.setItem(readingKey, estimatedValue);

    // Close dialog and confirm the reading
    setShowCantReadDialog(false);

    // Confirm the reading
    setLocalIsConfirmed(true);
    localStorage.setItem(confirmedKey, "true");
    onConfirmationChange(meter.ID, true);

    // Reset navigation state to prevent the navigation dialog from appearing
    setPendingNavigation(null);
    setNavigationHandledByChild(false);
  };

  // Handler for canceling
  const handleCancelCantRead = () => {
    setShowCantReadDialog(false);
  };

  // Update the historical readings display section

  // First, add this helper function near the top of your component
  const formatHistoricalDate = (
    dateString: string
  ): { month: string; year: string } => {
    try {
      const [year, monthName] = dateString.split("-");
      // Capitalize first letter only and use full month name
      const formattedMonth =
        monthName.charAt(0).toUpperCase() + monthName.slice(1).toLowerCase();
      return { month: formattedMonth, year };
    } catch (e) {
      return { month: "---", year: "---" };
    }
  };

  // Then replace the historical readings Paper component with this improved version
  <Paper
    elevation={0}
    sx={{
      p: 2,
      backgroundColor: alpha(theme.palette.background.default, 0.7),
      border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
      borderRadius: 2,
      height: "auto",
      minHeight: 200,
      overflow: "visible", // Explicitly set to visible to prevent scrolling
    }}
  >
    {historicalReadings && historicalReadings.length > 0 ? (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {historicalReadings.map((item, index) => {
          const { month, year } = formatHistoricalDate(item.date);
          return (
            <Box
              key={index}
              sx={{
                display: "flex",
                justifyContent: "space-between",
                p: 1.5,
                borderRadius: 1,
                backgroundColor: "transparent", // Remove background color
                borderBottom:
                  index !== historicalReadings.length - 1
                    ? `1px solid ${alpha(theme.palette.divider, 0.1)}`
                    : "none",
                "&:hover": {
                  backgroundColor: alpha(theme.palette.primary.light, 0.05),
                },
                // Use a left border instead of background for highlighting the most recent
                borderLeft:
                  index === 0
                    ? `3px solid ${theme.palette.primary.main}`
                    : "3px solid transparent",
                // Add subtle padding to compensate for the border
                pl: 2,
                // Remove shadow
                boxShadow: "none",
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center" }}>
                {/* Remove the circular container and display month and year together */}
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: index === 0 ? 700 : 600,
                    color:
                      index === 0
                        ? theme.palette.primary.main
                        : theme.palette.text.primary,
                    mr: 1,
                  }}
                >
                  {month}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: index === 0 ? 600 : 500,
                    color:
                      index === 0
                        ? theme.palette.primary.main
                        : theme.palette.text.secondary,
                  }}
                >
                  {year}
                </Typography>
              </Box>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  backgroundColor: item.isMissing
                    ? "transparent"
                    : index === 0
                    ? alpha(theme.palette.primary.main, 0.08) // Lighter background
                    : alpha(theme.palette.grey[100], 0.5),
                  px: 2,
                  py: 0.75,
                  borderRadius: 1.5,
                  minWidth: 80,
                  justifyContent: "center",
                  // Remove border
                  border: "none",
                }}
              >
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: index === 0 ? 700 : 600,
                    color: item.isMissing
                      ? theme.palette.text.secondary
                      : index === 0
                      ? theme.palette.primary.main
                      : theme.palette.text.primary,
                    fontSize: index === 0 ? "1rem" : "0.85rem",
                  }}
                >
                  {item.isMissing ? "—" : item.value}
                  {!item.isMissing && (
                    <Box
                      component="span"
                      sx={{
                        fontSize: index === 0 ? "0.8rem" : "0.75rem",
                        ml: 0.5,
                      }}
                    >
                      m³
                    </Box>
                  )}
                </Typography>
              </Box>
            </Box>
          );
        })}
      </Box>
    ) : (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100%",
        }}
      >
        <Typography variant="body2" color="text.secondary">
          No hay lecturas anteriores disponibles
        </Typography>
      </Box>
    )}
  </Paper>;

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      {/* Header with meter info and navigation pills */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 4,
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            backgroundColor: alpha(theme.palette.primary.main, 0.1),
            borderRadius: 2,
            px: 2,
            py: 1,
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

        <Typography
          variant="h6"
          sx={{ fontWeight: 600, color: theme.palette.text.secondary }}
        >
          {months[selectedMonth]} {selectedYear}
        </Typography>
      </Box>

      {/* Main Card with improved layout */}
      <Card
        elevation={3}
        sx={{
          borderRadius: 3,
          overflow: "visible",
          boxShadow: "0 6px 20px rgba(0,0,0,0.07)",
          mb: 4,
        }}
      >
        {/* Header Section */}
        <Box
          sx={{
            p: 3,
            background: `linear-gradient(to right, ${
              theme.palette.primary.main
            }, ${alpha(theme.palette.primary.main, 0.8)})`,
            color: "white",
            borderTopLeftRadius: 12,
            borderTopRightRadius: 12,
          }}
        >
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Box>
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
            <Chip
              icon={<AccessTimeIcon fontSize="small" />}
              label={`Última lectura: ${
                previousReadingEntries.length > 0
                  ? formatMonthOnly(previousReadingEntries[0]?.date)
                  : "N/A"
              }`}
              sx={{
                backgroundColor: "rgba(255,255,255,0.15)",
                color: "white",
                fontWeight: 500,
                "& .MuiChip-icon": { color: "white" },
              }}
            />
          </Box>
        </Box>

        {/* Content Section with Grid Layout */}
        <Box sx={{ p: 3 }}>
          <Grid container spacing={3}>
            {/* Left Column - Previous Readings */}
            <Grid item xs={12} md={5}>
              <Typography
                variant="subtitle1"
                fontWeight="600"
                sx={{ mb: 2, display: "flex", alignItems: "center" }}
              >
                <AccessTimeIcon
                  sx={{
                    mr: 1,
                    color: theme.palette.primary.main,
                    fontSize: 20,
                  }}
                />
                Historial de Lecturas
              </Typography>

              {/* Improved Historical Readings Display */}
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  backgroundColor: alpha(theme.palette.background.default, 0.7),
                  border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                  borderRadius: 2,
                  height: "auto",
                  minHeight: 200,
                  overflow: "visible", // Explicitly prevent scrolling
                }}
              >
                {historicalReadings && historicalReadings.length > 0 ? (
                  <Box
                    sx={{ display: "flex", flexDirection: "column", gap: 1 }}
                  >
                    {historicalReadings.map((item, index) => {
                      const [year, monthName] = item.date.split("-");
                      const month =
                        monthName.charAt(0).toUpperCase() + monthName.slice(1);

                      return (
                        <Box
                          key={index}
                          sx={{
                            display: "flex",
                            justifyContent: "space-between",
                            p: 1.5,
                            borderRadius: 1,
                            backgroundColor: "transparent",
                            borderBottom:
                              index !== historicalReadings.length - 1
                                ? `1px solid ${alpha(
                                    theme.palette.divider,
                                    0.1
                                  )}`
                                : "none",
                            "&:hover": {
                              backgroundColor: alpha(
                                theme.palette.primary.light,
                                0.05
                              ),
                            },
                            // Left border highlight for most recent
                            borderLeft:
                              index === 0
                                ? `3px solid ${theme.palette.primary.main}`
                                : "3px solid transparent",
                            pl: 2,
                          }}
                        >
                          <Box sx={{ display: "flex", alignItems: "center" }}>
                            <Typography
                              variant="body2"
                              sx={{
                                fontWeight: index === 0 ? 700 : 600,
                                color:
                                  index === 0
                                    ? theme.palette.primary.main
                                    : theme.palette.text.primary,
                                mr: 1,
                              }}
                            >
                              {month}
                            </Typography>
                            <Typography
                              variant="body2"
                              sx={{
                                fontWeight: index === 0 ? 600 : 500,
                                color:
                                  index === 0
                                    ? theme.palette.primary.main
                                    : theme.palette.text.secondary,
                              }}
                            >
                              {year}
                            </Typography>
                          </Box>
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              backgroundColor: item.isMissing
                                ? "transparent"
                                : index === 0
                                ? alpha(theme.palette.primary.main, 0.08)
                                : alpha(theme.palette.grey[100], 0.5),
                              px: 2,
                              py: 0.75,
                              borderRadius: 1.5,
                              minWidth: 80,
                              justifyContent: "center",
                            }}
                          >
                            <Typography
                              variant="body2"
                              sx={{
                                fontWeight: index === 0 ? 700 : 600,
                                color: item.isMissing
                                  ? theme.palette.text.secondary
                                  : index === 0
                                  ? theme.palette.primary.main
                                  : theme.palette.text.primary,
                                fontSize: index === 0 ? "1rem" : "0.85rem",
                              }}
                            >
                              {item.isMissing ? "—" : item.value}
                              {!item.isMissing && (
                                <Box
                                  component="span"
                                  sx={{
                                    fontSize:
                                      index === 0 ? "0.8rem" : "0.75rem",
                                    ml: 0.5,
                                  }}
                                >
                                  m³
                                </Box>
                              )}
                            </Typography>
                          </Box>
                        </Box>
                      );
                    })}
                  </Box>
                ) : (
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      height: "100%",
                    }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      No hay lecturas anteriores disponibles
                    </Typography>
                  </Box>
                )}
              </Paper>
            </Grid>

            {/* Right Column - Consumption Summary and Current Reading */}
            <Grid item xs={12} md={7}>
              {/* Consumption Summary */}
              <Typography
                variant="subtitle1"
                fontWeight="600"
                sx={{ mb: 2, display: "flex", alignItems: "center" }}
              >
                <InfoOutlinedIcon
                  sx={{
                    mr: 1,
                    color: theme.palette.primary.main,
                    fontSize: 20,
                  }}
                />
                Resumen de Consumo
              </Typography>

              <Grid container spacing={2} sx={{ mb: 3 }}>
                {/* Promedio de Consumo */}
                <Grid item xs={6}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2,
                      height: "100%",
                      borderRadius: 2,
                      backgroundColor: alpha(theme.palette.info.main, 0.08),
                      border: `1px solid ${alpha(
                        theme.palette.info.main,
                        0.15
                      )}`,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "center",
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
                    <Typography variant="h6" fontWeight={600} color="info.main">
                      {averageConsumption.toFixed(1) || "---"} m³
                    </Typography>
                  </Paper>
                </Grid>

                {/* Lectura Estimada */}
                <Grid item xs={6}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2,
                      height: "100%",
                      borderRadius: 2,
                      backgroundColor: alpha(theme.palette.warning.main, 0.08),
                      border: `1px solid ${alpha(
                        theme.palette.warning.main,
                        0.15
                      )}`,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "center",
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
                      variant="h6"
                      fontWeight={600}
                      color="warning.main"
                    >
                      {estimatedReading && estimatedReading !== "---"
                        ? `${estimatedReading} m³`
                        : "--- m³"}
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>

              {/* Current Reading Section */}
              <Typography
                variant="subtitle1"
                fontWeight="600"
                sx={{ mb: 2, mt: 4, display: "flex", alignItems: "center" }}
              >
                <CheckCircleOutlineIcon
                  sx={{
                    mr: 1,
                    color: theme.palette.primary.main,
                    fontSize: 20,
                  }}
                />
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
                  if (e.key === "Enter" && inputValue && !localIsConfirmed) {
                    e.preventDefault();
                    handleConfirmClick();
                  }
                }}
                disabled={localIsConfirmed}
                InputProps={{
                  endAdornment: <span style={{ marginLeft: "4px" }}>m³</span>,
                  sx: {
                    fontSize: "1.2rem",
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
                    bgcolor: localIsConfirmed ? alpha("#f5f5f5", 0.8) : "white",
                    borderRadius: 2,
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

              {/* Consumo Actual */}
              {inputValue &&
                previousReadingEntries.length > 0 &&
                previousReadingEntries[0]?.value && (
                  <Paper
                    elevation={0}
                    sx={{
                      mb: 3,
                      p: 2,
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

                        return alpha(theme.palette.grey[500], 0.15);
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

                        return alpha(theme.palette.grey[500], 0.05);
                      },
                      borderRadius: 2,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Box>
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
                        variant="h6"
                        fontWeight={600}
                        sx={{
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

                            return theme.palette.grey[600];
                          },
                        }}
                      >
                        {formatConsumption()} m³
                      </Typography>
                    </Box>

                    {/* Add a visual indicator of consumption trend */}
                    {(() => {
                      const consumptionValue = parseFloat(formatConsumption());
                      if (isNaN(consumptionValue)) return null;

                      if (consumptionValue > averageConsumption * 1.3) {
                        return (
                          <Chip
                            icon={<WarningIcon fontSize="small" />}
                            label="Consumo elevado"
                            color="warning"
                            size="small"
                          />
                        );
                      } else if (consumptionValue < 0) {
                        return (
                          <Chip
                            icon={<ErrorOutlineIcon fontSize="small" />}
                            label="Consumo negativo"
                            color="error"
                            size="small"
                          />
                        );
                      } else if (consumptionValue < 4) {
                        return (
                          <Chip
                            icon={<InfoOutlinedIcon fontSize="small" />}
                            label="Consumo bajo"
                            color="info"
                            size="small"
                          />
                        );
                      } else {
                        return (
                          <Chip
                            icon={<CheckCircleIcon fontSize="small" />}
                            label="Consumo normal"
                            color="success"
                            size="small"
                          />
                        );
                      }
                    })()}
                  </Paper>
                )}

              {/* Action Buttons */}
              <Box sx={{ display: "flex", gap: 2, mt: 3 }}>
                <Button
                  variant={localIsConfirmed ? "outlined" : "contained"}
                  color={localIsConfirmed ? "error" : "primary"}
                  onClick={() => {
                    if (localIsConfirmed) {
                      handleUnconfirmButtonClick();
                    } else {
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
                  sx={{
                    minWidth: 120,
                    py: 1.2,
                    px: 3,
                    borderRadius: 2,
                    boxShadow: localIsConfirmed ? "none" : 2,
                  }}
                >
                  {localIsConfirmed ? "Desconfirmar" : "Confirmar"}
                </Button>

                {!localIsConfirmed && (
                  <Button
                    variant="outlined"
                    color="secondary"
                    onClick={handleCantReadMeter}
                    startIcon={<ErrorOutlineIcon />}
                    sx={{
                      minWidth: 160,
                      py: 1.2,
                      px: 3,
                      borderRadius: 2,
                    }}
                  >
                    No puedo leer el medidor
                  </Button>
                )}
              </Box>
            </Grid>
          </Grid>
        </Box>
      </Card>

      {/* Navigation Buttons - Improved Layout */}
      <Paper
        elevation={2}
        sx={{
          p: 2,
          borderRadius: 3,
          backgroundColor: alpha(theme.palette.background.paper, 0.8),
          backdropFilter: "blur(8px)",
        }}
      >
        <Grid container spacing={2}>
          <Grid item xs={4}>
            <Button
              variant="outlined"
              startIcon={<ArrowBackIcon />}
              onClick={() => handleNavigation("prev", onPrev)}
              disabled={currentIndex === 0}
              sx={{
                width: "100%",
                py: 1.2,
                borderRadius: 2,
                borderWidth: "1.5px",
              }}
            >
              Anterior
            </Button>
          </Grid>

          <Grid item xs={4}>
            <Button
              variant="outlined"
              startIcon={<HomeOutlinedIcon />}
              onClick={() => handleNavigation("home", onHome)}
              sx={{
                width: "100%",
                py: 1.2,
                borderRadius: 2,
                borderWidth: "1.5px",
              }}
            >
              Inicio
            </Button>
          </Grid>

          <Grid item xs={4}>
            {currentIndex < totalMeters - 1 ? (
              <Button
                variant="contained"
                endIcon={<ArrowForwardIcon />}
                onClick={() => handleNavigation("next", onNext)}
                sx={{
                  width: "100%",
                  py: 1.2,
                  borderRadius: 2,
                  boxShadow: 2,
                }}
              >
                Siguiente
              </Button>
            ) : (
              <Button
                variant="contained"
                color="success"
                onClick={() => handleNavigation("finish", onFinish)}
                sx={{
                  width: "100%",
                  py: 1.2,
                  borderRadius: 2,
                  boxShadow: 2,
                }}
              >
                Finalizar
              </Button>
            )}
          </Grid>
        </Grid>
      </Paper>

      {/* Enhanced Navigation Confirmation Dialog */}
      <Dialog
        open={isNavigationDialogOpen}
        onClose={() => setIsNavigationDialogOpen(false)}
        aria-labelledby="navigation-dialog-title"
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle
          id="navigation-dialog-title"
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
            <Typography>Lectura Sin Confirmar</Typography>
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
                    Medidor:
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {meter.ID}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    Lectura Ingresada:
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {inputValue}
                  </Typography>
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
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Ha ingresado una lectura pero no la ha confirmado.
            </Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
              Si continúa sin confirmar, la lectura no será ingresada.
            </Typography>
          </Alert>

          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
            ¿Qué desea hacer?
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
            onClick={() => setIsNavigationDialogOpen(false)}
            color="inherit"
            variant="outlined"
            sx={{ minWidth: 120 }}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleLeaveUnconfirmed}
            color="warning"
            variant="outlined"
            sx={{ minWidth: 120 }}
          >
            Continuar Sin Confirmar
          </Button>
          <Button
            onClick={handleConfirmAndNavigate}
            color="success"
            variant="contained"
            sx={{ minWidth: 120 }}
            startIcon={<CheckCircleIcon />}
          >
            Confirmar y Continuar
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
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
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
                  situación de esta propiedad. Por favor siga estos pasos:
                </Typography>
                <List dense disablePadding sx={{ mt: 0.5 }}>
                  <ListItem sx={{ py: 0.5 }}>
                    <ListItemText primary="1. Toque a la puerta de la propiedad" />
                  </ListItem>
                  <ListItem sx={{ py: 0.5 }}>
                    <ListItemText primary="2. Complete el siguiente cuestionario" />
                  </ListItem>
                </List>
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
                    value={
                      verificationData.answeredDoor === undefined
                        ? ""
                        : verificationData.answeredDoor
                        ? "yes"
                        : "no"
                    }
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

        {verificationStep === 2 && verificationData.answeredDoor === true && (
          <>
            <DialogTitle
              id="low-consumption-dialog-title-step2"
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
                <Typography>Verificación - Cliente Presente</Typography>
              </Box>
            </DialogTitle>
            <DialogContent sx={{ px: 3, py: 3 }}>
              <Typography variant="body1" paragraph>
                Por favor complete la siguiente información con los datos
                proporcionados por el cliente:
              </Typography>

              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                  ¿Ha tenido problemas con el suministro de agua?
                </Typography>
                <Box
                  sx={{
                    p: 2,
                    border: 1,
                    borderColor: alpha(theme.palette.primary.main, 0.2),
                    borderRadius: 1,
                    backgroundColor: alpha(theme.palette.primary.main, 0.02),
                    mb: 3,
                  }}
                >
                  <FormControl component="fieldset" sx={{ width: "100%" }}>
                    <RadioGroup
                      value={
                        verificationData.hadIssues === undefined
                          ? ""
                          : verificationData.hadIssues
                          ? "yes"
                          : "no"
                      }
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

                {verificationData.hadIssues && (
                  <Box sx={{ mb: 3 }}>
                    <Typography
                      variant="subtitle1"
                      sx={{ fontWeight: 500, mb: 1 }}
                    >
                      Describa brevemente el problema:
                    </Typography>
                    <TextField
                      fullWidth
                      multiline
                      rows={2}
                      placeholder="Describa el problema reportado por el cliente"
                      value={verificationData.issueDescription || ""}
                      onChange={handleIssueDescriptionChange}
                      variant="outlined"
                      sx={{ backgroundColor: "white" }}
                    />
                  </Box>
                )}

                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                  ¿Cuántos meses lleva viviendo en esta propiedad?
                </Typography>
                <TextField
                  fullWidth
                  type="number"
                  placeholder="Ingrese el número de meses"
                  value={verificationData.residenceMonths || ""}
                  onChange={handleResidenceMonthsChange}
                  variant="outlined"
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">meses</InputAdornment>
                    ),
                  }}
                  sx={{ backgroundColor: "white" }}
                />
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
                  verificationData.hadIssues === undefined ||
                  (verificationData.hadIssues === true &&
                    !verificationData.issueDescription) ||
                  !verificationData.residenceMonths
                }
                startIcon={<CheckCircleIcon />}
                sx={{ minWidth: 140 }}
              >
                Guardar y Confirmar
              </Button>
            </DialogActions>
          </>
        )}

        {verificationStep === 2 && verificationData.answeredDoor === false && (
          <>
            <DialogTitle
              id="low-consumption-dialog-title-step2"
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
                <Typography>Verificación - Sin Respuesta</Typography>
              </Box>
            </DialogTitle>
            <DialogContent sx={{ px: 3, py: 3 }}>
              <Typography variant="body1" paragraph>
                Ya que no hubo respuesta en la propiedad, por favor observe y
                responda:
              </Typography>

              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                  ¿La propiedad parece habitada?
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
                      value={
                        verificationData.looksLivedIn === undefined
                          ? ""
                          : verificationData.looksLivedIn
                          ? "yes"
                          : "no"
                      }
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
                </Box>

                <Box sx={{ mt: 3 }}>
                  <Alert severity="info">
                    <Typography variant="body2">
                      Señales de que una propiedad está habitada incluyen:
                    </Typography>
                    <List dense disablePadding>
                      <ListItem sx={{ py: 0.5 }}>
                        <ListItemText primary="• Luces encendidas" />
                      </ListItem>
                      <ListItem sx={{ py: 0.5 }}>
                        <ListItemText primary="• Vehículos estacionados" />
                      </ListItem>
                      <ListItem sx={{ py: 0.5 }}>
                        <ListItemText primary="• Jardín mantenido" />
                      </ListItem>
                      <ListItem sx={{ py: 0.5 }}>
                        <ListItemText primary="• Cortinas/persianas abiertas" />
                      </ListItem>
                    </List>
                  </Alert>
                </Box>
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
                disabled={verificationData.looksLivedIn === undefined}
                startIcon={<CheckCircleIcon />}
                sx={{ minWidth: 140 }}
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
              pt: 2,
              mb: 2,
              color: "text.primary",
              fontSize: "1rem",
            }}
            component="div"
          >
            Si desconfirma esta lectura y continua sin confirmar, no se agregará
            al archivo de lecturas.
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
            puede confirmarla. De lo contrario, regrese para corregir el valor.
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
                              currentConsumptionRef.current / averageConsumption
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
            <List dense disablePadding sx={{ mt: 0.5 }}>
              <ListItem sx={{ py: 0.5 }}>
                <ListItemText primary="• Fuga de agua en la propiedad" />
              </ListItem>
              <ListItem sx={{ py: 0.5 }}>
                <ListItemText primary="• Uso excesivo de agua en el período" />
              </ListItem>
              <ListItem sx={{ py: 0.5 }}>
                <ListItemText primary="• Error en la lectura anterior (subestimada)" />
              </ListItem>
              <ListItem sx={{ py: 0.5 }}>
                <ListItemText primary="• Error al ingresar la lectura actual" />
              </ListItem>
            </List>
          </Alert>

          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
            ¿Desea continuar?
          </Typography>
          <Typography variant="body2">
            Si está seguro que la lectura actual ({inputValue}) es correcta,
            puede confirmarla. De lo contrario, regrese para corregir el valor.
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

      {/* Can't Read Meter Dialog */}
      <Dialog
        open={showCantReadDialog}
        onClose={handleCancelCantRead}
        aria-labelledby="cant-read-dialog-title"
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle
          id="cant-read-dialog-title"
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
            <ErrorOutlineIcon color="info" />
            <Typography>No se puede leer el medidor</Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ px: 3, py: 3 }}>
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
              Información del Medidor:
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
                    ID del Medidor:
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {meter.ID}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    Lectura Estimada:
                  </Typography>
                  <Typography
                    variant="h6"
                    sx={{
                      fontWeight: 600,
                      color: theme.palette.warning.dark,
                    }}
                  >
                    {estimatedReading} m³
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary">
                    Dirección:
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    {meter.ADDRESS}
                  </Typography>
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
              Se utilizará la lectura estimada
            </Typography>
            <Typography variant="body2">
              Por favor indique el motivo por el cual no puede realizar la
              lectura del medidor. Esta información es importante para mejorar
              el servicio.
            </Typography>
          </Alert>

          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
            Motivo:
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
                value={cantReadReason}
                onChange={handleReasonChange}
                sx={{ flexDirection: "column", gap: 1 }}
              >
                <FormControlLabel
                  value="damaged_meter"
                  control={<Radio color="primary" />}
                  label="Medidor dañado o ilegible"
                  sx={{
                    "& .MuiFormControlLabel-label": {
                      fontWeight: 500,
                    },
                  }}
                />
                <FormControlLabel
                  value="access_blocked"
                  control={<Radio color="primary" />}
                  label="Acceso bloqueado (reja, cerca, etc.)"
                  sx={{
                    "& .MuiFormControlLabel-label": {
                      fontWeight: 500,
                    },
                  }}
                />
                <FormControlLabel
                  value="animals"
                  control={<Radio color="primary" />}
                  label="Animales impiden acceso (perros, etc.)"
                  sx={{
                    "& .MuiFormControlLabel-label": {
                      fontWeight: 500,
                    },
                  }}
                />
                <FormControlLabel
                  value="other"
                  control={<Radio color="primary" />}
                  label="Otro motivo"
                  sx={{
                    "& .MuiFormControlLabel-label": {
                      fontWeight: 500,
                    },
                  }}
                />
              </RadioGroup>
            </FormControl>

            {cantReadReason === "other" && (
              <TextField
                fullWidth
                multiline
                rows={2}
                placeholder="Describa el motivo por el cual no puede leer el medidor"
                value={otherReasonText}
                onChange={handleOtherReasonChange}
                variant="outlined"
                sx={{ mt: 2, backgroundColor: "white" }}
              />
            )}
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
            onClick={handleCancelCantRead}
            color="inherit"
            variant="outlined"
            sx={{ minWidth: 100 }}
          >
            Cancelar
          </Button>
          <Box sx={{ flex: 1 }} />
          <Button
            onClick={handleConfirmEstimatedReading}
            color="primary"
            variant="contained"
            disabled={
              cantReadReason === "" ||
              (cantReadReason === "other" && otherReasonText.trim() === "")
            }
            startIcon={<CheckCircleIcon />}
            sx={{ minWidth: 140 }}
          >
            Confirmar Estimación
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default MeterScreen;

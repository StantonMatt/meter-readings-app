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

import {
  MeterData,
  ReadingsState,
  storeMeterReading,
  getMeterReading,
  clearMeterReading,
  determineConsumptionType,
  ConsumptionType,
  MeterReadingData,
} from "./utils/readingUtils";
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
  onPreviousReadingsUpdate?: (meterId: string, readings: any) => void;
  readingsState: ReadingsState;
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

// Helper function to format historical dates
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
  onPreviousReadingsUpdate,
  readingsState,
}: MeterScreenProps): JSX.Element {
  const theme = useTheme();

  // Create unique keys for this meter's reading and confirmation state
  const readingKey = `meter_${meter.ID}_reading`;
  const confirmedKey = `meter_${meter.ID}_confirmed`;

  // First, update the initial state declarations
  const [inputValue, setInputValue] = useState<string>(() => {
    const meterData = getMeterReading(meter.ID);
    if (meterData?.reading) {
      return meterData.reading;
    }
    const stateReading = readingsState?.[meter.ID]?.reading;
    if (stateReading && typeof stateReading === "string") {
      return stateReading;
    }
    return "";
  });

  const [localIsConfirmed, setLocalIsConfirmed] = useState<boolean>(() => {
    const meterData = getMeterReading(meter.ID);
    if (meterData?.isConfirmed !== undefined) {
      return Boolean(meterData.isConfirmed);
    }
    const stateConfirmed = readingsState?.[meter.ID]?.isConfirmed;
    if (stateConfirmed !== undefined) {
      return Boolean(stateConfirmed);
    }
    return false;
  });

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

  // First, add a new state for the empty input dialog
  const [showEmptyInputDialog, setShowEmptyInputDialog] =
    useState<boolean>(false);

  // Initialize input value and confirmation status when meter changes
  useEffect(() => {
    // Restore meter data when the meter changes or component mounts
    const meterData = getMeterReading(meter.ID);

    // Always start with a clean slate when meter changes
    if (meterData) {
      // Restore reading value if it exists for this specific meter
      if (meterData.reading) {
        setInputValue(meterData.reading);
      } else {
        setInputValue(""); // Reset if no reading exists
      }

      // Restore confirmation state
      setLocalIsConfirmed(meterData.isConfirmed || false);

      // Restore consumption data if available
      if (meterData.consumption) {
        currentConsumptionRef.current = meterData.consumption.value;
      } else {
        currentConsumptionRef.current = null;
      }
    } else {
      // If no stored data, check readingsState prop for backward compatibility
      const reading = readingsState?.[meter.ID];
      if (reading?.reading) {
        setInputValue(reading.reading);
        setLocalIsConfirmed(reading.isConfirmed || false);
      } else {
        // Reset state for new meter
        setInputValue("");
        setLocalIsConfirmed(false);
      }
    }
  }, [meter.ID]); // Only depend on meter.ID changes

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

    // Add a ref to track if we've already fetched for this meter in this session
    const requestId = `meter_${meter.ID}_route_${routeId}_request`;

    const fetchPreviousReadings = async () => {
      // Skip if this exact API call is already in progress
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

          // Call the new handler to update the parent component
          // Only call this once when data is successfully loaded
          if (onPreviousReadingsUpdate && response) {
            onPreviousReadingsUpdate(meter.ID.toString(), response);
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

    // Only fetch when the component mounts or when the meter ID changes
    // Don't include onPreviousReadingsUpdate in the dependencies
    fetchPreviousReadings();

    return () => {
      isMounted = false;
      // Clean up the request flag when component unmounts
      delete (window as any)[requestId];
    };
  }, [meter.ID, routeId, selectedMonth, selectedYear]); // Remove onPreviousReadingsUpdate from dependencies

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

  // Add this effect near the top of the component, after state declarations
  useEffect(() => {
    // Restore meter data when the meter changes or component mounts
    const meterData = getMeterReading(meter.ID);

    if (meterData) {
      // Only update states if the values are different
      if (meterData.reading && meterData.reading !== inputValue) {
        setInputValue(meterData.reading);
      }
      if (meterData.isConfirmed !== localIsConfirmed) {
        setLocalIsConfirmed(meterData.isConfirmed);
      }
      if (meterData.consumption) {
        currentConsumptionRef.current = meterData.consumption.value;
      }
    } else {
      // If no stored data, check readingsState prop for backward compatibility
      const reading = readingsState?.[meter.ID];
      if (reading) {
        if (reading.reading && reading.reading !== inputValue) {
          setInputValue(reading.reading);
        }
        if (reading.isConfirmed !== localIsConfirmed) {
          setLocalIsConfirmed(reading.isConfirmed || false);
        }
      }
    }
  }, [meter.ID, readingsState]); // Remove onReadingChange and onConfirmationChange from dependencies

  // Update handleInputChange to allow empty values
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onReadingChange(meter.ID, newValue);

    // Only calculate consumption if we have a non-empty value
    if (newValue && previousReadingEntries.length > 0) {
      const currentReading = parseFloat(newValue);
      const previousValue = previousReadingEntries[0]?.value || 0;

      if (!isNaN(currentReading) && !isNaN(previousValue)) {
        const consumptionType = determineConsumptionType(
          currentReading,
          previousValue,
          averageConsumption
        );

        // Get existing data to preserve other fields
        const existingData = getMeterReading(meter.ID);

        // Store complete reading data
        storeMeterReading(meter.ID, {
          ...existingData,
          reading: newValue,
          previousReading: String(previousValue),
          consumption: consumptionType,
          isConfirmed: existingData?.isConfirmed || false,
          timestamp: new Date().toISOString(),
          averageConsumption,
          historicalReadings: previousReadingEntries,
        });

        // Store the calculated consumption for later use
        currentConsumptionRef.current = consumptionType.value;
      }
    } else {
      // If the value is empty, clear the consumption data but preserve verification
      const existingData = getMeterReading(meter.ID);
      if (existingData) {
        storeMeterReading(meter.ID, {
          ...existingData,
          reading: "",
          consumption: undefined,
          isConfirmed: false,
        });
      }
    }
  };

  // Estimate the next reading
  const suggestedReading = useMemo(() => {
    if (meter.estimatedReading === null) return "";
    return Math.round(meter.estimatedReading).toString();
  }, [meter.estimatedReading]);

  // Add this useEffect to monitor for pending navigation
  useEffect(() => {
    if (
      pendingNavigation &&
      !showEmptyInputDialog &&
      !showCantReadDialog &&
      !showLowConsumptionDialog &&
      !showHighConsumptionDialog &&
      !showNegativeConsumptionDialog
    ) {
      setIsNavigationDialogOpen(true);
    }
  }, [
    pendingNavigation,
    showEmptyInputDialog,
    showCantReadDialog,
    showLowConsumptionDialog,
    showHighConsumptionDialog,
    showNegativeConsumptionDialog,
  ]);

  // Simplify navigation handling
  const handleNavigation = (type: string, navigationAction: () => void) => {
    setNavigationType(type as "prev" | "next" | "home" | "other" | "none");

    // If there's no reading input, show the empty input dialog
    if (!inputValue || inputValue.trim() === "") {
      setShowEmptyInputDialog(true);
      setNavigationHandledByChild(true);
      setPendingNavigation(() => navigationAction);
    }
    // If there's a reading but it's not confirmed, show the confirmation dialog
    else if (inputValue && !localIsConfirmed) {
      setIsNavigationDialogOpen(true);
      setNavigationHandledByChild(true);
      setPendingNavigation(() => navigationAction);
    } else {
      // Reading is confirmed, just navigate
      navigationAction();
    }
  };

  // Update handleConfirmAndNavigate to use stored data
  const handleConfirmAndNavigate = async () => {
    const meterData = getMeterReading(meter.ID);

    if (!inputValue || !previousReadingEntries.length) {
      if (pendingNavigation) {
        pendingNavigation();
        setPendingNavigation(null);
        setNavigationHandledByChild(false);
      }
      return;
    }

    // Use stored consumption data if available
    const consumptionType =
      meterData?.consumption ||
      determineConsumptionType(
        parseFloat(inputValue),
        previousReadingEntries[0]?.value || 0,
        averageConsumption
      );

    // Close the navigation dialog first
    setIsNavigationDialogOpen(false);

    // Check consumption type and show appropriate dialog
    if (consumptionType.type === "negative") {
      setShowNegativeConsumptionDialog(true);
      return;
    }

    if (consumptionType.type === "high") {
      setShowHighConsumptionDialog(true);
      return;
    }

    if (consumptionType.type === "low") {
      // Check if we already have verification data
      if (!meterData?.verification) {
        setVerificationStep(1);
        setVerificationData({});
        setShowLowConsumptionDialog(true);
        return;
      }
    }

    // If we get here, either there's no special case or it's already been handled
    confirmAndNavigate();
  };

  // Update confirmAndNavigate to ensure we store the final state
  const confirmAndNavigate = () => {
    const meterData = getMeterReading(meter.ID);

    // Store the final confirmed state with all data
    storeMeterReading(meter.ID, {
      ...meterData,
      isConfirmed: true,
      timestamp: new Date().toISOString(),
    });

    // Update local state
    setLocalIsConfirmed(true);
    onConfirmationChange(meter.ID, true);

    // Use a small timeout to allow state to propagate
    setTimeout(() => {
      if (pendingNavigation) {
        pendingNavigation();
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
    // First, update the local state and parent state
    setLocalIsConfirmed(true);
    onConfirmationChange(meter.ID, true);

    // Store the reading with verification data
    storeMeterReading(meter.ID, {
      reading: inputValue,
      isConfirmed: true,
      consumption: {
        type: "low",
        label: "Baja",
        value: parseFloat(formatConsumption()),
      },
      verification: {
        type: "lowConsumption",
        details: verificationData,
        timestamp: new Date().toISOString(),
      },
    });

    // Close dialog
    setShowLowConsumptionDialog(false);

    // Store the current navigation callback
    const currentNavigation = pendingNavigation;

    // Reset navigation state
    setPendingNavigation(null);
    setNavigationHandledByChild(false);

    // Execute navigation after a small delay to ensure state updates are processed
    if (currentNavigation) {
      setTimeout(() => {
        currentNavigation();
      }, 50);
    }
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

  // Update handleConfirmClick to use stored consumption data
  const handleConfirmClick = () => {
    const meterData = getMeterReading(meter.ID);

    if (!inputValue || !previousReadingEntries.length) {
      return; // Don't proceed if we don't have valid input
    }

    // Calculate consumption type fresh each time
    const consumptionType = determineConsumptionType(
      parseFloat(inputValue),
      previousReadingEntries[0]?.value || 0,
      averageConsumption
    );

    // Store the current consumption type
    storeMeterReading(meter.ID, {
      ...meterData,
      reading: inputValue,
      consumption: consumptionType,
      timestamp: new Date().toISOString(),
    });

    // Check consumption type and show appropriate dialog
    if (consumptionType.type === "negative") {
      setShowNegativeConsumptionDialog(true);
      return;
    }

    if (consumptionType.type === "high") {
      setShowHighConsumptionDialog(true);
      return;
    }

    if (consumptionType.type === "low") {
      // Always show the dialog for low consumption, regardless of previous verification
      setVerificationStep(1);
      setVerificationData({});
      setShowLowConsumptionDialog(true);
      return;
    }

    // If we get here, either there's no special case or it's already been handled
    setLocalIsConfirmed(true);
    onConfirmationChange(meter.ID, true);
  };

  // Add these handlers if they're missing
  const handleCancelLowConsumptionDialog = () => {
    setShowLowConsumptionDialog(false);
    setVerificationStep(1);
    setVerificationData({});
    // Clear stored data when canceling
    const existingData = getMeterReading(meter.ID);
    if (existingData) {
      storeMeterReading(meter.ID, {
        ...existingData,
        isConfirmed: false,
        consumption: undefined,
      });
    }
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

    // Get existing data to preserve historical readings
    const existingData = getMeterReading(meter.ID);

    // Store the unconfirmed state while preserving the reading
    storeMeterReading(meter.ID, {
      ...existingData,
      isConfirmed: false,
      verification: undefined, // Clear any verification data
    });
  };

  // Add these handler functions:
  const handleUnconfirmButtonClick = () => {
    // Show confirmation dialog instead of immediately unconfirming
    setShowUnconfirmDialog(true);
  };

  const handleCancelUnconfirm = () => {
    setShowUnconfirmDialog(false);
  };

  // Update handleConfirmUnconfirm to properly clear all states
  const handleConfirmUnconfirm = () => {
    // Close the dialog
    setShowUnconfirmDialog(false);

    // Clear local state
    setLocalIsConfirmed(false);
    setVerificationData({});

    // Update parent state
    onConfirmationChange(meter.ID, false);

    // Get existing data to preserve historical readings
    const existingData = getMeterReading(meter.ID);

    // Calculate the current consumption type based on the input value
    const currentReading = parseFloat(inputValue);
    const previousValue = previousReadingEntries[0]?.value || 0;
    const consumptionType = determineConsumptionType(
      currentReading,
      previousValue,
      averageConsumption
    );

    // Store the unconfirmed state while preserving the reading and historical data
    storeMeterReading(meter.ID, {
      reading: existingData?.reading || inputValue,
      isConfirmed: false,
      consumption: consumptionType, // Store the recalculated consumption type
      verification: undefined, // Clear verification data
      historicalReadings: existingData?.historicalReadings, // Preserve historical readings
      averageConsumption: existingData?.averageConsumption, // Preserve average consumption
    });
  };

  // Update formatConsumption to use stored consumption data
  const formatConsumption = () => {
    // First check if we have stored consumption data
    const meterData = getMeterReading(meter.ID);
    if (meterData?.consumption) {
      return meterData.consumption.value.toFixed(1);
    }

    // If no stored data, calculate it
    if (
      !inputValue ||
      !previousReadingEntries.length ||
      !previousReadingEntries[0]?.value
    ) {
      return "---";
    }

    const currentReading = parseFloat(inputValue);
    const previousReading = parseFloat(String(previousReadingEntries[0].value));

    if (isNaN(currentReading) || isNaN(previousReading)) {
      return "---";
    }

    const consumption = currentReading - previousReading;
    return consumption.toFixed(1);
  };

  // Add helper function to check if reading is estimated
  const isEstimatedReading = () => {
    const verification = localStorage.getItem(`meter_${meter.ID}_verification`);
    if (!verification) return false;
    try {
      const data = JSON.parse(verification);
      return data.type === "cantRead";
    } catch {
      return false;
    }
  };

  // Add these handlers for negative consumption dialog
  const handleCancelNegativeConsumptionDialog = () => {
    setShowNegativeConsumptionDialog(false);
    // Clear stored data when canceling
    const existingData = getMeterReading(meter.ID);
    if (existingData) {
      storeMeterReading(meter.ID, {
        ...existingData,
        isConfirmed: false,
        consumption: undefined,
      });
    }
    // Reset pending navigation since we're canceling
    setPendingNavigation(null);
    setNavigationHandledByChild(false);
  };

  // Update handleConfirmNegativeReading
  const handleConfirmNegativeReading = () => {
    // First, update the local state and parent state
    setLocalIsConfirmed(true);
    onConfirmationChange(meter.ID, true);

    // Store the reading with verification data
    storeMeterReading(meter.ID, {
      reading: inputValue,
      isConfirmed: true,
      consumption: {
        type: "negative",
        label: "Negativa",
        value: parseFloat(formatConsumption()),
      },
      verification: {
        type: "negativeConsumption",
        details: {},
        timestamp: new Date().toISOString(),
      },
    });

    // Close the dialog
    setShowNegativeConsumptionDialog(false);

    // Store the current navigation callback
    const currentNavigation = pendingNavigation;

    // Reset navigation state
    setPendingNavigation(null);
    setNavigationHandledByChild(false);

    // Execute navigation after a small delay to ensure state updates are processed
    if (currentNavigation) {
      setTimeout(() => {
        currentNavigation();
      }, 50);
    }
  };

  // Add these handlers for high consumption dialog
  const handleCancelHighConsumptionDialog = () => {
    setShowHighConsumptionDialog(false);
    // Clear stored data when canceling
    const existingData = getMeterReading(meter.ID);
    if (existingData) {
      storeMeterReading(meter.ID, {
        ...existingData,
        isConfirmed: false,
        consumption: undefined,
      });
    }
    // Reset pending navigation since we're canceling
    setPendingNavigation(null);
    setNavigationHandledByChild(false);
  };

  // Update handleConfirmHighConsumption
  const handleConfirmHighConsumption = () => {
    // First, update the local state and parent state
    setLocalIsConfirmed(true);
    onConfirmationChange(meter.ID, true);

    // Store the reading with verification data
    storeMeterReading(meter.ID, {
      reading: inputValue,
      isConfirmed: true,
      consumption: {
        type: "high",
        label: "Elevada",
        value: parseFloat(formatConsumption()),
      },
      verification: {
        type: "highConsumption",
        details: {},
        timestamp: new Date().toISOString(),
      },
    });

    // Close the dialog
    setShowHighConsumptionDialog(false);

    // Store the current navigation callback
    const currentNavigation = pendingNavigation;

    // Reset navigation state
    setPendingNavigation(null);
    setNavigationHandledByChild(false);

    // Execute navigation after a small delay to ensure state updates are processed
    if (currentNavigation) {
      setTimeout(() => {
        currentNavigation();
      }, 50);
    }
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
    // First, update the local state and parent state
    setLocalIsConfirmed(true);
    onConfirmationChange(meter.ID, true);

    // Calculate the consumption value for the estimated reading
    const previousValue = previousReadingEntries[0]?.value || 0;
    const estimatedValue = parseFloat(estimatedReading.toString());
    const consumptionValue = estimatedValue - parseFloat(String(previousValue));

    // Store the estimated reading with verification data
    storeMeterReading(meter.ID, {
      reading: estimatedReading.toString(),
      isConfirmed: true,
      previousReading: String(previousValue),
      consumption: {
        type: "estimated",
        label: "Estimada",
        value: consumptionValue,
      },
      verification: {
        type: "cantRead",
        details: {
          reason: cantReadReason,
          otherReason: cantReadReason === "other" ? otherReasonText : undefined,
        },
        timestamp: new Date().toISOString(),
      },
    });

    // Update UI state
    setInputValue(estimatedReading.toString());
    setShowCantReadDialog(false);

    // Update parent component
    onReadingChange(meter.ID, estimatedReading.toString());

    // Store the current navigation callback
    const currentNavigation = pendingNavigation;

    // Reset navigation state
    setPendingNavigation(null);
    setNavigationHandledByChild(false);

    // Execute navigation after a small delay to ensure state updates are processed
    if (currentNavigation) {
      setTimeout(() => {
        currentNavigation();
      }, 50);
    }
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

  // Add handlers for the new dialog
  const handleEmptyInputContinue = () => {
    setShowEmptyInputDialog(false);

    // Execute the pending navigation
    if (pendingNavigation) {
      pendingNavigation();
      setPendingNavigation(null);
      setNavigationHandledByChild(false);
    }
  };

  // Update the handleEmptyCantReadMeter function to store the pending navigation
  const handleEmptyCantReadMeter = () => {
    // Close the empty input dialog
    setShowEmptyInputDialog(false);
    // Close the navigation dialog if it's open
    setIsNavigationDialogOpen(false);
    // Open the can't read meter dialog
    setShowCantReadDialog(true);
    // Keep the navigation handled by child flag true since we're still handling it
    setNavigationHandledByChild(true);
    // Don't reset the pending navigation - we'll use it after confirming the estimated reading
  };

  const handleEmptyInputCancel = () => {
    setShowEmptyInputDialog(false);
    setPendingNavigation(null);
    setNavigationHandledByChild(false);
  };

  // Add this useEffect to monitor for pending navigation
  useEffect(() => {
    if (
      pendingNavigation &&
      !showEmptyInputDialog &&
      !showCantReadDialog &&
      !showLowConsumptionDialog &&
      !showHighConsumptionDialog &&
      !showNegativeConsumptionDialog
    ) {
      // Only show navigation dialog if we're not in the process of confirming a reading
      const meterData = getMeterReading(meter.ID);
      if (!meterData?.isConfirmed) {
        setIsNavigationDialogOpen(true);
      }
    }
  }, [
    pendingNavigation,
    showEmptyInputDialog,
    showCantReadDialog,
    showLowConsumptionDialog,
    showHighConsumptionDialog,
    showNegativeConsumptionDialog,
    localIsConfirmed,
    meter.ID,
  ]);

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      {/* Header with meter info and navigation pills */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 1,
          mt: 4,
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
          sx={{ pr: 1, fontWeight: 800, color: theme.palette.text.secondary }}
        >
          {months[selectedMonth]} - {selectedYear}
        </Typography>
      </Box>

      {/* Main Card with improved layout */}
      <Card
        elevation={3}
        sx={{
          borderRadius: 3,
          overflow: "visible",
          boxShadow: "0 6px 20px rgba(0,0,0,0.07)",
          mb: 3,
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
              <Typography
                variant="h4"
                sx={{ color: "white", mt: 1, opacity: 0.9 }}
              >
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
                      backgroundColor: alpha("rgba(79, 70, 229, 0.7)", 0.08),
                      border: `1px solid ${alpha(
                        "rgba(79, 70, 229, 0.7)",
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
                      color="rgba(79, 70, 229, 0.9)"
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
                      borderColor: (theme) => {
                        const meterData = getMeterReading(meter.ID);
                        if (!meterData?.consumption)
                          return alpha(theme.palette.grey[500], 0.15);

                        switch (meterData.consumption.type) {
                          case "estimated":
                            return "rgba(79, 70, 229, 0.3)"; // Purple border for estimated
                          case "negative":
                            return alpha(theme.palette.error.main, 0.3); // Red border
                          case "low":
                            return alpha(theme.palette.info.main, 0.3); // Blue border
                          case "high":
                            return alpha(theme.palette.grey[500], 0.3); // Gray border
                          case "normal":
                            return alpha(theme.palette.success.main, 0.3); // Green border
                          default:
                            return alpha(theme.palette.grey[500], 0.15);
                        }
                      },
                      bgcolor: (theme) => {
                        const meterData = getMeterReading(meter.ID);
                        if (!meterData?.consumption)
                          return alpha(theme.palette.grey[500], 0.05);

                        switch (meterData.consumption.type) {
                          case "estimated":
                            return "rgba(79, 70, 229, 0.05)"; // Light purple bg for estimated
                          case "negative":
                            return alpha(theme.palette.error.main, 0.05); // Light red bg
                          case "low":
                            return alpha(theme.palette.info.main, 0.05); // Light blue bg
                          case "high":
                            return alpha(theme.palette.grey[500], 0.05); // Light gray bg
                          case "normal":
                            return alpha(theme.palette.success.main, 0.05); // Light green bg
                          default:
                            return alpha(theme.palette.grey[500], 0.05);
                        }
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
                          color: (theme) => {
                            const meterData = getMeterReading(meter.ID);
                            if (meterData?.consumption?.type === "estimated") {
                              return "rgba(79, 70, 229, 0.9)"; // Purple for estimated
                            }
                            if (meterData?.consumption?.type === "high") {
                              return theme.palette.grey[700]; // Dark gray for high
                            }
                            if (meterData?.consumption?.type === "negative") {
                              return theme.palette.error.main;
                            }
                            if (meterData?.consumption?.type === "low") {
                              return theme.palette.info.main;
                            }
                            return theme.palette.success.main;
                          },
                        }}
                      >
                        {formatConsumption()} m³
                      </Typography>
                    </Box>

                    {/* Add a visual indicator of consumption trend */}
                    {(() => {
                      const meterData = getMeterReading(meter.ID);
                      if (meterData?.consumption?.type === "estimated") {
                        return (
                          <Chip
                            icon={<InfoOutlinedIcon fontSize="small" />}
                            label="Consumo estimado"
                            sx={{
                              backgroundColor: "rgba(79, 70, 229, 0.1)",
                              color: "rgba(79, 70, 229, 0.9)",
                              borderColor: "rgba(79, 70, 229, 0.3)",
                              fontWeight: 600,
                            }}
                            size="small"
                          />
                        );
                      }

                      if (meterData?.consumption?.type === "high") {
                        return (
                          <Chip
                            icon={<WarningIcon fontSize="small" />}
                            label="Consumo elevado"
                            sx={{
                              backgroundColor: alpha(
                                theme.palette.grey[500],
                                0.1
                              ),
                              color: theme.palette.grey[700],
                              borderColor: alpha(theme.palette.grey[500], 0.3),
                              fontWeight: 600,
                            }}
                            size="small"
                          />
                        );
                      }

                      if (meterData?.consumption?.type === "negative") {
                        return (
                          <Chip
                            icon={<ErrorOutlineIcon fontSize="small" />}
                            label="Consumo negativo"
                            color="error"
                            size="small"
                          />
                        );
                      }

                      if (meterData?.consumption?.type === "low") {
                        return (
                          <Chip
                            icon={<InfoOutlinedIcon fontSize="small" />}
                            label="Consumo bajo"
                            color="info"
                            size="small"
                          />
                        );
                      }

                      return (
                        <Chip
                          icon={<CheckCircleIcon fontSize="small" />}
                          label="Consumo normal"
                          color="success"
                          size="small"
                        />
                      );
                    })()}
                  </Paper>
                )}

              {/* Action Buttons */}
              <Box sx={{ display: "flex", gap: 2, mt: 3 }}>
                {/* Move "No puedo leer" button to the left and style it with purple */}
                <Button
                  variant="outlined"
                  onClick={handleCantReadMeter}
                  startIcon={<ErrorOutlineIcon />}
                  sx={{
                    ml: 1,
                    borderRadius: 2,
                    borderColor: "rgba(79, 70, 229, 0.5)",
                    color: "rgba(79, 70, 229, 0.9)",
                    "&:hover": {
                      backgroundColor: "rgba(79, 70, 229, 0.05)",
                      borderColor: "rgba(79, 70, 229, 0.8)",
                    },
                    // Add opacity styling when disabled
                    "&.Mui-disabled": {
                      borderColor: "rgba(79, 70, 229, 0.2)",
                      color: "rgba(79, 70, 229, 0.4)",
                    },
                  }}
                  // Disable when reading is confirmed
                  disabled={localIsConfirmed}
                >
                  No puedo leer el medidor
                </Button>

                {/* Move Confirm button to the right */}
                <Button
                  variant="contained"
                  color={localIsConfirmed ? "warning" : "success"} // Changed from "error" to "warning"
                  onClick={() => {
                    if (localIsConfirmed) {
                      // Handle unconfirm action
                      handleUnconfirmButtonClick();
                    } else {
                      // Handle confirm action
                      handleConfirmClick();
                    }
                  }}
                  startIcon={
                    localIsConfirmed ? <WarningIcon /> : <CheckCircleIcon />
                  }
                  sx={{
                    borderRadius: 2,
                    ml: "auto",
                    mr: 1,
                    ...(localIsConfirmed && {
                      backgroundColor: "#f59e0b", // Amber/yellow color
                      "&:hover": {
                        backgroundColor: "#d97706", // Darker amber on hover
                      },
                    }),
                  }}
                  // Only disable when it's the confirm button AND the input is empty
                  disabled={
                    !localIsConfirmed &&
                    (!inputValue || inputValue.trim() === "")
                  }
                >
                  {localIsConfirmed ? "Desconfirmar" : "Confirmar Lectura"}
                </Button>
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
                borderRadius: 3,
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
                onClick={() => handleNavigation("finish", onFinish)}
                sx={{
                  width: "100%",
                  py: 1.2,
                  borderRadius: 3,
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
            backgroundColor: alpha(theme.palette.grey[500], 0.1),
            px: 3,
            py: 2.5,
            "& .MuiTypography-root": {
              fontSize: "1.25rem",
              fontWeight: 600,
            },
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <WarningAmberIcon sx={{ color: theme.palette.grey[700] }} />
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
            severity="info"
            variant="outlined"
            sx={{
              mb: 3,
              borderColor: alpha(theme.palette.grey[500], 0.5),
              backgroundColor: alpha(theme.palette.grey[500], 0.05),
              "& .MuiAlert-icon": {
                color: theme.palette.grey[700],
              },
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
            sx={{
              minWidth: 140,
              backgroundColor: theme.palette.grey[700],
              color: "white",
              "&:hover": {
                backgroundColor: theme.palette.grey[800],
              },
            }}
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
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            overflow: "hidden",
          },
        }}
      >
        <DialogTitle
          sx={{
            backgroundColor: "rgba(79, 70, 229, 0.1)",
            color: "rgba(79, 70, 229, 0.9)",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            fontSize: "1.25rem",
            py: 2.5,
            px: 3,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <ErrorOutlineIcon sx={{ color: "rgba(79, 70, 229, 0.9)" }} />
            <Typography>No se puede leer el medidor</Typography>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ p: 3, pt: 3 }}>
          <Box sx={{ mb: 3 }}>
            <Paper
              elevation={0}
              sx={{
                p: 2,
                backgroundColor: "rgba(79, 70, 229, 0.05)",
                border: "1px solid rgba(79, 70, 229, 0.2)",
                borderRadius: 1,
              }}
            >
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    Lectura Estimada:
                  </Typography>
                  <Typography
                    variant="h4"
                    sx={{ color: "rgba(79, 70, 229, 0.9)", fontWeight: 700 }}
                  >
                    {estimatedReading}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    Basado en el consumo promedio
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
              borderColor: "rgba(79, 70, 229, 0.5)",
              backgroundColor: "rgba(79, 70, 229, 0.05)",
              "& .MuiAlert-icon": {
                color: "rgba(79, 70, 229, 0.9)",
              },
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
            sx={{
              minWidth: 140,
              backgroundColor: "rgba(79, 70, 229, 0.9)",
              color: "white",
              "&:hover": {
                backgroundColor: "rgba(79, 70, 229, 1)",
              },
            }}
            disabled={
              cantReadReason === "" ||
              (cantReadReason === "other" && otherReasonText.trim() === "")
            }
            startIcon={<CheckCircleIcon />}
          >
            Confirmar Estimación
          </Button>
        </DialogActions>
      </Dialog>

      {/* Empty Input Navigation Dialog */}
      <Dialog
        open={showEmptyInputDialog}
        onClose={handleEmptyInputCancel}
        aria-labelledby="empty-input-dialog-title"
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle
          id="empty-input-dialog-title"
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
            <Typography>Lectura No Ingresada</Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ px: 3, py: 3 }}>
          <Alert
            severity="warning"
            variant="outlined"
            sx={{
              mt: 2,
              mb: 3,
              "& .MuiAlert-message": {
                fontWeight: 500,
              },
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              No ha ingresado ninguna lectura para este medidor.
            </Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
              Si no puede acceder al medidor o tiene dificultad para leerlo,
              utilice la opción "No puedo leer el medidor" para registrar una
              lectura estimada.
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
            onClick={handleEmptyInputCancel}
            color="inherit"
            variant="outlined"
            sx={{ minWidth: 120 }}
          >
            Volver al Medidor
          </Button>
          <Button
            onClick={handleEmptyCantReadMeter}
            color="primary"
            variant="outlined"
            sx={{
              minWidth: 200,
              borderColor: "rgba(79, 70, 229, 0.5)",
              color: "rgba(79, 70, 229, 0.9)",
              "&:hover": {
                backgroundColor: "rgba(79, 70, 229, 0.05)",
                borderColor: "rgba(79, 70, 229, 0.8)",
              },
            }}
            startIcon={<ErrorOutlineIcon />}
          >
            No Puedo Leer el Medidor
          </Button>
          <Button
            onClick={handleEmptyInputContinue}
            color="warning"
            variant="contained"
            sx={{ minWidth: 120 }}
          >
            Continuar Sin Lectura
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default MeterScreen;

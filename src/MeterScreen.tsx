import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";

import {
  Paper,
  Typography,
  Box,
  Button,
  TextField,
  Container,
  FormControlLabel,
  Checkbox,
  RadioGroup,
  Radio,
  FormLabel,
  FormControl,
  Grid,
  Chip,
  Divider,
  Card,
  CardContent,
  Stack,
  alpha,
  useTheme,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Alert,
  InputAdornment,
} from "@mui/material";

import { MeterData } from "./utils/readingUtils";
import { months } from "./utils/dateUtils";

import ArrowBackIcon from "@mui/icons-material/ArrowBack";

import ArrowForwardIcon from "@mui/icons-material/ArrowForward";

import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

import HistoryIcon from "@mui/icons-material/History";

import WarningAmberIcon from "@mui/icons-material/WarningAmber";

import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";

import HelpOutlineIcon from "@mui/icons-material/HelpOutline";

import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";

import AccessTimeIcon from "@mui/icons-material/AccessTime";

import CheckCircleIcon from "@mui/icons-material/CheckCircle";

import WarningIcon from "@mui/icons-material/Warning";

import { createPortal } from "react-dom";

import { findPreviousMonthReading } from "./utils/dateUtils";

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

// Add this helper function at the top level

const storeVerificationData = (
  meterId: string | number,

  type: string,

  data: { details: any; [key: string]: any },

  resolved: boolean = true
): void => {
  localStorage.setItem(
    `meter_${meterId}_verification`,

    JSON.stringify({
      type,

      ...data,

      resolved,

      timestamp: new Date().toISOString(),
    })
  );
};

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
}

// Add a month order mapping function at the top of the file or import it

const getMonthOrder = (monthName: string): number => {
  const months: Record<string, number> = {
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

  return months[monthName.toLowerCase()] || 0;
};

// Add this at the top level

const INPUT_DEBOUNCE_MS = 500; // Debounce delay for input

// Add these enum types for clarity at the top of your file

enum NavigationAction {
  NONE,

  PREV,

  NEXT,

  HOME,

  FINISH,
}

// Add these interfaces/types at the top of your file

interface NavigationIntent {
  type: "prev" | "next" | "home" | "finish" | "none";

  action: () => void;
}

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
}: MeterScreenProps): JSX.Element {
  const theme = useTheme();

  // Create unique keys for this meter's reading and confirmation state

  const readingKey = `meter_${meter.ID}_reading`;

  const confirmedKey = `meter_${meter.ID}_confirmed`;

  // We need a LOCAL inputValue separate from the persisted reading

  const [inputValue, setInputValue] = useState<string>("");

  const [isConfirmed, setIsConfirmed] = useState<boolean>(false);

  // Add this ref inside the component function
  const previousValueRef = useRef<string>("");

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

  // Extract and memoize the previous readings from the meter data for performance
  const previousEntries = useMemo(() => {
    if (!meter.readings) return [];

    // Convert the readings object to an array of entries, excluding ID and ADDRESS
    return Object.entries(meter.readings)
      .filter(([key]) => key !== "ID" && key !== "ADDRESS")
      .sort((a, b) => {
        // Sort by date in descending order (most recent first)
        return new Date(b[0]).getTime() - new Date(a[0]).getTime();
      });
  }, [meter.readings]);

  // Remove the useEffect and state for consumption calculation
  // Instead, add a ref to store the calculated consumption
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

          console.log(
            `Looking for previous month reading with patterns: ${prevMonthPattern1} or ${prevMonthPattern2}`
          );

          // Log all available reading keys for debugging
          console.log(
            "Available reading keys:",
            Object.keys(meter.readings).filter(
              (key) => key !== "ID" && key !== "ADDRESS"
            )
          );

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
              console.log(
                `Found exact match for previous month: ${key} = ${value}`
              );
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

            console.log(
              "Sorted readings:",
              readingsArray.map((r) => ({
                key: r.key,
                date: r.date.toISOString().slice(0, 7),
                value: r.value,
              }))
            );

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
                console.log(
                  `Found closest previous reading: ${reading.key} = ${reading.value}`
                );
                break;
              }
            }
          }

          // Now calculate consumption with the found value
          if (prevReading !== null) {
            const previousReading = parseFloat(String(prevReading || "0"));

            console.log(`Calculating consumption for meter ${meter.ID}:`);
            console.log(`  Current reading: ${currentReading}`);
            console.log(
              `  Previous month (${prevReadingKey}) reading: ${previousReading}`
            );

            const consumption = parseFloat(
              (currentReading - previousReading).toFixed(1)
            );
            console.log(`  Calculated consumption: ${consumption} m³`);

            // Store the calculated value
            currentConsumptionRef.current = consumption;
          } else {
            console.log(`No suitable previous reading found for comparison`);
            currentConsumptionRef.current = null;
          }
        } else {
          console.log(
            `Invalid reading value: ${newValue}, cannot calculate consumption`
          );
          currentConsumptionRef.current = null;
        }
      } catch (e) {
        console.error("Error calculating consumption:", e);
        currentConsumptionRef.current = null;
      }
    } else {
      console.log("No readings data available for this meter");
      currentConsumptionRef.current = null;
    }
  };

  // Estimate the next reading

  const previousReading =
    previousEntries.length > 0 ? previousEntries[0][1] : "---";

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
    if (inputValue && !isConfirmed) {
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
    setIsConfirmed(true);

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

  // Replace the validateConsumption function with this version that doesn't log anything
  const validateConsumption = (): boolean => {
    if (!inputValue) return true;

    const currentValue = parseFloat(inputValue);

    // If there are no previous readings, allow the reading
    if (previousEntries.length === 0) return true;

    const prevReading = previousEntries[previousEntries.length - 1][1];
    if (prevReading === "---" || prevReading === "NO DATA") return true;

    const previousValue = parseFloat(String(prevReading));
    const consumption = currentValue - previousValue;

    // For any issues, just silently return true without logging
    return true;
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
      previousReading: previousEntries.length > 0 ? previousEntries[0][1] : "0",
      previousReadingDate:
        previousEntries.length > 0 ? previousEntries[0][0] : null,
      timestamp: new Date().toISOString(),
    };

    // Save to localStorage
    localStorage.setItem(
      `meter_${meter.ID}_verification`,
      JSON.stringify(verificationInfo)
    );

    // Close dialog and confirm the reading
    setShowLowConsumptionDialog(false);
    setIsConfirmed(true);
    localStorage.setItem(confirmedKey, "true");
    onConfirmationChange(meter.ID, true);
  };

  // Format the month to show only the month name without year

  const formatMonthOnly = (dateKey: string): string => {
    const parts = dateKey.split("-");

    if (parts.length >= 2) {
      // This assumes the date format is YYYY-MMM or similar

      return parts[1].charAt(0).toUpperCase() + parts[1].slice(1);
    }

    return dateKey;
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
          setIsConfirmed(true);
        }

        if (parsedData.type === "lowConsumption" && !parsedData.resolved) {
          // Restore the low consumption verification dialog state

          if (parsedData.details) {
            setIsConfirmed(true);
          }
        }

        if (parsedData.type === "negativeConsumption" && !parsedData.resolved) {
          setIsConfirmed(true);
        }
      } catch (e) {
        console.error("Error restoring verification data:", e);
      }
    }
  }, [meter.ID]);

  // Add a useEffect for debugging

  useEffect(() => {
    console.log("[DEBUG-METER] showConfirmDialog changed to:", isConfirmed);
  }, [isConfirmed]);

  // Update the handleConfirmClick function
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
            if (previousEntries.length > 0) {
              const lastReadingEntry = previousEntries[0];
              const fallbackReading = parseFloat(
                String(lastReadingEntry[1] || "0")
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

    // Check if this is a low consumption case (>= 0 and < 4)
    if (consumption !== null && consumption >= 0 && consumption < 4) {
      // Check if we already have verification data
      const storedVerification = localStorage.getItem(
        `meter_${meter.ID}_verification`
      );

      if (storedVerification) {
        // If we already verified this meter, just confirm normally
        setIsConfirmed(true);
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
      setIsConfirmed(true);
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
    setIsConfirmed(false);

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
    setIsConfirmed(false);

    // Update parent state
    onConfirmationChange(meter.ID, false);

    // Update localStorage
    localStorage.removeItem(confirmedKey);

    // Also remove verification data from localStorage
    localStorage.removeItem(`meter_${meter.ID}_verification`);
  };

  // Find this function or similar in the component
  const formatConsumption = (): string => {
    // Update this function to use the correctly calculated consumption
    if (currentConsumptionRef.current === null || !inputValue) {
      return "---";
    }

    // Use the correctly calculated consumption value
    return currentConsumptionRef.current.toFixed(1);
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

                {previousEntries.length > 0 ? (
                  <Box
                    sx={{
                      display: "flex",

                      overflowX: "auto",

                      pb: 1,

                      gap: 2,

                      "&::-webkit-scrollbar": {
                        height: "6px",
                      },

                      "&::-webkit-scrollbar-thumb": {
                        backgroundColor: "rgba(0,0,0,0.1)",

                        borderRadius: "3px",
                      },
                    }}
                  >
                    {previousEntries.map(([dateKey, value], index) => (
                      <Box
                        key={dateKey}
                        sx={{
                          minWidth: "80px",

                          p: 1.5,

                          backgroundColor:
                            index === previousEntries.length - 1
                              ? alpha(theme.palette.primary.main, 0.08)
                              : "rgba(0,0,0,0.03)",

                          border:
                            index === previousEntries.length - 1
                              ? `1px solid ${alpha(
                                  theme.palette.primary.main,

                                  0.15
                                )}`
                              : "1px solid rgba(0,0,0,0.06)",

                          borderRadius: 1,

                          textAlign: "center",
                        }}
                      >
                        <Typography
                          variant="caption"
                          sx={{
                            display: "block",

                            fontWeight: 500,

                            color:
                              index === previousEntries.length - 1
                                ? "primary.main"
                                : "text.secondary",

                            mb: 0.5,
                          }}
                        >
                          {formatMonthOnly(dateKey)}
                        </Typography>

                        <Typography
                          variant="body1"
                          fontWeight={600}
                          color={
                            index === previousEntries.length - 1
                              ? "primary.main"
                              : "text.primary"
                          }
                        >
                          {value} m³
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No hay lecturas anteriores
                  </Typography>
                )}
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
                        {meter.averageConsumption?.toFixed(1) || "---"} m³
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
                        {suggestedReading || "---"} m³
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
                    if (e.key === "Enter" && inputValue && !isConfirmed) {
                      e.preventDefault(); // Prevent form submission if inside a form
                      handleConfirmClick();
                    }
                  }}
                  disabled={isConfirmed}
                  InputProps={{
                    endAdornment: <Typography sx={{ ml: 1 }}>m³</Typography>,

                    sx: {
                      fontSize: "1.1rem",

                      fontWeight: 500,

                      backgroundColor: isConfirmed
                        ? alpha("#f5f5f5", 0.8)
                        : "white",

                      opacity: isConfirmed ? 0.8 : 1,

                      "& input": {
                        color: "text.primary",

                        WebkitTextFillColor: isConfirmed
                          ? "rgba(0, 0, 0, 0.7) !important"
                          : undefined,

                        fontWeight: isConfirmed ? 600 : 500,
                      },
                    },
                  }}
                  sx={{
                    mb: 2,

                    "& .MuiOutlinedInput-root": {
                      bgcolor: isConfirmed ? alpha("#f5f5f5", 0.8) : "white",

                      borderRadius: 1,
                    },

                    "& .MuiInputLabel-root": {
                      color: isConfirmed ? "text.secondary" : undefined,
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
                  previousEntries.length > 0 &&
                  previousEntries[previousEntries.length - 1][1] && (
                    <Box
                      sx={{
                        mb: 2.5,

                        p: 1.5,

                        border: "1px solid",

                        borderColor: (consumption) => {
                          const consumptionValue =
                            parseFloat(inputValue) -
                            parseFloat(
                              String(
                                previousEntries[
                                  previousEntries.length - 1
                                ][1] || "0"
                              )
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
                              String(
                                previousEntries[
                                  previousEntries.length - 1
                                ][1] || "0"
                              )
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
                                String(
                                  previousEntries[
                                    previousEntries.length - 1
                                  ][1] || "0"
                                )
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
                    variant={isConfirmed ? "outlined" : "contained"}
                    color={isConfirmed ? "error" : "primary"}
                    onClick={() => {
                      if (isConfirmed) {
                        // Show confirmation dialog instead of immediately unconfirming
                        handleUnconfirmButtonClick();
                      } else {
                        // Confirm logic
                        handleConfirmClick();
                      }
                    }}
                    disabled={inputValue.trim() === ""}
                    startIcon={
                      isConfirmed ? <WarningIcon /> : <CheckCircleOutlineIcon />
                    }
                    sx={{ minWidth: 120 }}
                  >
                    {isConfirmed ? "Desconfirmar" : "Confirmar"}
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
          PaperProps={{
            sx: {
              borderRadius: 2,
              boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
              overflow: "hidden",
              maxWidth: 550,
            },
          }}
        >
          {verificationStep === 1 && (
            <>
              <DialogTitle
                id="low-consumption-dialog-title"
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
                  <Typography>Consumo Inusualmente Bajo</Typography>
                </Box>
              </DialogTitle>
              <DialogContent sx={{ px: 3, py: 3 }}>
                <DialogContentText
                  sx={{ color: "text.primary", mb: 2, fontSize: "1rem" }}
                >
                  El consumo calculado{" "}
                  <Chip
                    label={`${
                      currentConsumptionRef.current !== null
                        ? currentConsumptionRef.current
                        : "?"
                    } m³`}
                    color="primary"
                    size="small"
                    sx={{
                      fontWeight: 600,
                      ml: 0.5,
                      mr: 0.5,
                      fontSize: "0.85rem",
                      height: 24,
                      "& .MuiChip-label": {
                        px: 1.2,
                      },
                    }}
                  />{" "}
                  es inusualmente bajo.
                </DialogContentText>
                <Alert
                  severity="warning"
                  sx={{
                    mb: 2,
                    "& .MuiAlert-message": {
                      fontWeight: 500,
                    },
                  }}
                >
                  ¿Está seguro que la lectura{" "}
                  <Box component="span" fontWeight="bold">
                    {inputValue}
                  </Box>{" "}
                  es correcta?
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
                  onClick={handleCancelLowConsumptionDialog}
                  color="inherit"
                  variant="outlined"
                  sx={{ minWidth: 140 }}
                >
                  Cancelar y Editar
                </Button>
                <Button
                  onClick={handleConfirmLowReading}
                  color="warning"
                  variant="contained"
                  sx={{ minWidth: 140 }}
                  startIcon={<CheckCircleIcon />}
                >
                  Confirmar Lectura
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
                      ¿Alguien atendió la puerta?
                    </FormLabel>
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
                          "& .MuiFormControlLabel-label": { fontWeight: 500 },
                        }}
                      />
                      <FormControlLabel
                        value="no"
                        control={<Radio color="primary" />}
                        label="No"
                        sx={{
                          "& .MuiFormControlLabel-label": { fontWeight: 500 },
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
      </Box>
    </Container>
  );
}

export default MeterScreen;

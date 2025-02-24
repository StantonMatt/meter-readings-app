import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Paper,
  Typography,
  Box,
  Button,
  TextField,
  Container,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Checkbox,
  RadioGroup,
  Radio,
  FormLabel,
  FormControl,
} from "@mui/material";
import { MeterData } from "./utils/readingUtils";

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
  data: { details: any; [key: string]: any }
): void => {
  localStorage.setItem(
    `meter_${meterId}_verification`,
    JSON.stringify({
      type,
      ...data,
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
  showConfirmDialog: boolean;
  setShowConfirmDialog: React.Dispatch<React.SetStateAction<boolean>>;
  pendingNavigation: (() => void) | null;
  setPendingNavigation: React.Dispatch<
    React.SetStateAction<(() => void) | null>
  >;
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
  showConfirmDialog,
  setShowConfirmDialog,
  pendingNavigation,
  setPendingNavigation,
}: MeterScreenProps): JSX.Element {
  // Create unique keys for this meter's reading and confirmation state
  const readingKey = useMemo(() => `meter_${meter.ID}_reading`, [meter.ID]);
  const confirmedKey = useMemo(() => `meter_${meter.ID}_confirmed`, [meter.ID]);

  // Initialize state from localStorage
  const [reading, setReading] = useState<string>(
    () => localStorage.getItem(readingKey) || ""
  );
  const [isConfirmed, setIsConfirmed] = useState<boolean>(
    () => localStorage.getItem(confirmedKey) === "true"
  );

  // When the meter changes, update state from localStorage.
  useEffect(() => {
    setReading(localStorage.getItem(`meter_${meter.ID}_reading`) || "");
    setIsConfirmed(
      localStorage.getItem(`meter_${meter.ID}_confirmed`) === "true"
    );
  }, [meter]);

  // Debounce the localStorage updates
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      localStorage.setItem(readingKey, reading);
      onReadingChange(meter.ID, reading);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [reading, readingKey, meter.ID, onReadingChange]);

  // Update the sorting logic in MeterScreen.jsx
  const previousEntries = Object.entries(meter.readings)
    .filter(([k]) => k !== "ID")
    .sort((a, b) => {
      const [yearA, monthA] = a[0].split("-");
      const [yearB, monthB] = b[0].split("-");

      // Create a more explicit month mapping
      const monthToNum: { [key: string]: number } = {
        Enero: 1,
        Ene: 1,
        Febrero: 2,
        Feb: 2,
        Marzo: 3,
        Mar: 3,
        Abril: 4,
        Abr: 4,
        Mayo: 5,
        May: 5,
        Junio: 6,
        Jun: 6,
        Julio: 7,
        Jul: 7,
        Agosto: 8,
        Ago: 8,
        Septiembre: 9,
        Sep: 9,
        Octubre: 10,
        Oct: 10,
        Noviembre: 11,
        Nov: 11,
        Diciembre: 12,
        Dic: 12,
      };

      // First compare years
      if (yearA !== yearB) {
        return parseInt(yearB) - parseInt(yearA);
      }

      // Then compare months
      const monthNumA = monthToNum[monthA] || 0;
      const monthNumB = monthToNum[monthB] || 0;
      return monthNumB - monthNumA;
    });

  // Estimate the next reading
  const previousReading =
    previousEntries.length > 0 ? previousEntries[0][1] : "---";
  const suggestedReading = useMemo(() => {
    if (meter.estimatedReading === null) return "";
    return Math.round(meter.estimatedReading).toString();
  }, [meter.estimatedReading]);

  // Detect high consumption
  const [showHighConsumptionDialog, setShowHighConsumptionDialog] =
    useState<boolean>(false);
  const [highConsumptionConfirmed, setHighConsumptionConfirmed] =
    useState<boolean>(false);

  // Detect low or negative consumption
  const [showLowConsumptionDialog, setShowLowConsumptionDialog] =
    useState<boolean>(false);
  const [lowConsumptionAnsweredDoor, setLowConsumptionAnsweredDoor] =
    useState<boolean>(false);
  const [lowConsumptionHadIssues, setLowConsumptionHadIssues] =
    useState<boolean>(false);
  const [lowConsumptionLooksLivedIn, setLowConsumptionLooksLivedIn] =
    useState<boolean>(true);
  const [lowConsumptionResidenceMonths, setLowConsumptionResidenceMonths] =
    useState<string>("12");

  // Detect negative consumption
  const [showNegativeConsumptionDialog, setShowNegativeConsumptionDialog] =
    useState<boolean>(false);
  const [negativeConsumptionConfirmed, setNegativeConsumptionConfirmed] =
    useState<boolean>(false);

  // Handle save and continue
  const handleSaveAndContinue = (): void => {
    // Save reading state
    localStorage.setItem(readingKey, reading);
    localStorage.setItem(confirmedKey, isConfirmed.toString());

    // Update parent state
    onReadingChange(meter.ID, reading);
    onConfirmationChange(meter.ID, isConfirmed);

    // Go to next meter
    onNext();
  };

  // Verify reading - this triggers any necessary dialogs
  const verifyReading = useCallback((): boolean => {
    // Skip verification if not confirmed
    if (!isConfirmed) return true;

    // Skip verification if reading is empty
    if (!reading) return true;

    // Parse readings
    const currentValue = parseFloat(reading);
    let previousValue = null;

    try {
      if (
        previousReading &&
        previousReading !== "---" &&
        previousReading !== "NO DATA"
      ) {
        previousValue = parseFloat(String(previousReading));
      }
    } catch (e) {
      console.error("Error parsing previous reading:", e);
    }

    // Skip additional checks if previous reading is not available
    if (previousValue === null) return true;

    // Check for negative consumption
    if (currentValue < previousValue) {
      // Show negative consumption dialog if not already confirmed
      if (!negativeConsumptionConfirmed) {
        setShowNegativeConsumptionDialog(true);
        return false;
      }
    }

    // Get historical readings for comparison
    const consumption = currentValue - previousValue;
    const averageConsumption = meter.averageConsumption;

    // If consumption is unusually high and not already confirmed
    const highConsumptionThreshold = Math.max(
      averageConsumption * 1.5,
      averageConsumption + 10
    );
    if (
      consumption > highConsumptionThreshold &&
      consumption > 10 &&
      !highConsumptionConfirmed
    ) {
      setShowHighConsumptionDialog(true);
      return false;
    }

    // If consumption is unusually low
    if (
      consumption < 3 &&
      previousValue !== null &&
      // Only for meters that normally use water
      averageConsumption > 3
    ) {
      // Check if we already verified this
      const verificationData = localStorage.getItem(
        `meter_${meter.ID}_verification`
      );
      if (!verificationData) {
        setShowLowConsumptionDialog(true);
        return false;
      }
    }

    return true;
  }, [
    isConfirmed,
    reading,
    meter.ID,
    meter.averageConsumption,
    previousReading,
    negativeConsumptionConfirmed,
    highConsumptionConfirmed,
  ]);

  // Handle confirmation change
  const handleConfirmationChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ): void => {
    const newConfirmed = event.target.checked;
    setIsConfirmed(newConfirmed);

    // Update localStorage
    localStorage.setItem(confirmedKey, newConfirmed.toString());

    // Update parent state
    onConfirmationChange(meter.ID, newConfirmed);

    // If we're turning on confirmation, verify the reading
    if (newConfirmed) {
      verifyReading();
    }
  };

  // Handle high consumption confirmation
  const handleHighConsumptionConfirm = (): void => {
    setHighConsumptionConfirmed(true);
    setShowHighConsumptionDialog(false);

    // Store the verification information
    const consumptionValue =
      parseFloat(reading) - parseFloat(String(previousReading || "0"));
    storeVerificationData(meter.ID, "highConsumption", {
      previousReading,
      currentReading: reading,
      consumption: consumptionValue,
      average: meter.averageConsumption,
      percentageAboveAverage:
        (consumptionValue / meter.averageConsumption) * 100 - 100,
      details: {},
    });
  };

  // Handle low consumption confirmation
  const handleLowConsumptionConfirm = (): void => {
    setShowLowConsumptionDialog(false);

    // Store verification information
    let residenceMonthsNum = 12;
    try {
      residenceMonthsNum = parseInt(lowConsumptionResidenceMonths);
      if (isNaN(residenceMonthsNum)) residenceMonthsNum = 12;
    } catch (e) {
      console.error("Error parsing residence months:", e);
    }

    // Store the verification data
    const consumptionValue =
      parseFloat(reading) - parseFloat(String(previousReading || "0"));
    storeVerificationData(meter.ID, "lowConsumption", {
      previousReading,
      currentReading: reading,
      consumption: consumptionValue,
      details: {
        answeredDoor: lowConsumptionAnsweredDoor,
        hadIssues: lowConsumptionHadIssues,
        looksLivedIn: lowConsumptionLooksLivedIn,
        residenceMonths: residenceMonthsNum,
      },
    });
  };

  // Handle negative consumption confirmation
  const handleNegativeConsumptionConfirm = (): void => {
    setNegativeConsumptionConfirmed(true);
    setShowNegativeConsumptionDialog(false);

    // Store verification information
    const consumptionValue =
      parseFloat(reading) - parseFloat(String(previousReading || "0"));
    storeVerificationData(meter.ID, "negativeConsumption", {
      previousReading,
      currentReading: reading,
      consumption: consumptionValue,
      details: {},
    });
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
        <Box sx={{ mb: 2 }}>
          <Typography variant="h5" gutterBottom>
            Medidor {meter.ID}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {meter.ADDRESS}
          </Typography>
        </Box>

        <Box sx={{ mb: 4 }}>
          <Typography variant="subtitle1" gutterBottom>
            Lecturas Anteriores
          </Typography>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {previousEntries.length > 0 ? (
              previousEntries.slice(0, 5).map(([date, value]) => (
                <Box
                  key={date}
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    borderBottom: "1px solid rgba(0,0,0,0.1)",
                    p: 1,
                  }}
                >
                  <Typography variant="body2">{date}</Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {value}
                  </Typography>
                </Box>
              ))
            ) : (
              <Typography variant="body2" color="text.secondary">
                No hay lecturas anteriores
              </Typography>
            )}
          </Box>
        </Box>

        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" gutterBottom>
            Consumo mensual
          </Typography>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                p: 1,
              }}
            >
              <Typography variant="body2">Consumo promedio:</Typography>
              <Typography variant="body2" fontWeight="bold">
                {meter.averageConsumption} m³
              </Typography>
            </Box>
          </Box>
        </Box>

        <Box
          component="form"
          sx={{ display: "flex", flexDirection: "column", gap: 2 }}
        >
          <TextField
            label="Lectura Actual"
            variant="outlined"
            fullWidth
            value={reading}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setReading(e.target.value)
            }
            error={reading !== "" && !/^\d+$/.test(reading)}
            helperText={
              reading !== "" && !/^\d+$/.test(reading)
                ? "La lectura debe ser un número"
                : ""
            }
            autoFocus
            sx={{ mb: 1 }}
          />

          {suggestedReading && reading === "" && (
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                p: 1,
                bgcolor: "rgba(3, 169, 244, 0.1)",
                borderRadius: 1,
              }}
            >
              <Typography variant="body2">Lectura estimada:</Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Typography variant="body2" fontWeight="bold">
                  {suggestedReading}
                </Typography>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => setReading(suggestedReading)}
                >
                  Usar
                </Button>
              </Box>
            </Box>
          )}

          <FormControlLabel
            control={
              <Checkbox
                checked={isConfirmed}
                onChange={handleConfirmationChange}
                color="primary"
              />
            }
            label="Confirmar lectura"
          />

          <Box sx={{ display: "flex", justifyContent: "space-between", mt: 2 }}>
            <Button
              variant="outlined"
              onClick={onPrev}
              disabled={currentIndex === 0}
            >
              Anterior
            </Button>
            <Box>
              <Button variant="outlined" onClick={onHome} sx={{ mr: 1 }}>
                Inicio
              </Button>
              <Button
                variant="contained"
                onClick={() => {
                  if (verifyReading()) {
                    handleSaveAndContinue();
                  }
                }}
                disabled={isConfirmed && !reading}
              >
                {currentIndex === totalMeters - 1 ? "Finalizar" : "Siguiente"}
              </Button>
            </Box>
          </Box>
        </Box>
      </Paper>

      {/* Navigation confirm dialog */}
      <Dialog
        open={showConfirmDialog}
        onClose={() => setShowConfirmDialog(false)}
      >
        <DialogTitle>¿Continuar sin confirmar?</DialogTitle>
        <DialogContent>
          <Typography>
            Ha ingresado una lectura pero no la ha confirmado. ¿Desea continuar
            sin confirmar la lectura?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowConfirmDialog(false)}>Cancelar</Button>
          <Button
            onClick={() => {
              setShowConfirmDialog(false);
              if (pendingNavigation) {
                pendingNavigation();
                setPendingNavigation(null);
              }
            }}
            variant="contained"
          >
            Continuar sin confirmar
          </Button>
        </DialogActions>
      </Dialog>

      {/* High Consumption Dialog */}
      <Dialog
        open={showHighConsumptionDialog}
        onClose={() => setShowHighConsumptionDialog(false)}
      >
        <DialogTitle>Verificar Consumo Alto</DialogTitle>
        <DialogContent>
          <Typography paragraph color="error">
            El consumo es inusualmente alto (
            {reading && previousReading !== "---"
              ? parseFloat(reading) - parseFloat(String(previousReading || "0"))
              : "N/A"}{" "}
            m³).
          </Typography>
          <Typography paragraph>
            El consumo promedio es de {meter.averageConsumption} m³.
          </Typography>
          <Typography paragraph>
            Por favor verifique que la lectura sea correcta.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setShowHighConsumptionDialog(false)}
            color="primary"
          >
            Revisar Lectura
          </Button>
          <Button
            onClick={handleHighConsumptionConfirm}
            color="error"
            variant="contained"
          >
            Confirmar Consumo Alto
          </Button>
        </DialogActions>
      </Dialog>

      {/* Low Consumption Dialog */}
      <Dialog
        open={showLowConsumptionDialog}
        onClose={() => setShowLowConsumptionDialog(false)}
      >
        <DialogTitle>Verificar Consumo Bajo</DialogTitle>
        <DialogContent>
          <Typography paragraph>
            El consumo es bajo (
            {reading && previousReading !== "---"
              ? parseFloat(reading) - parseFloat(String(previousReading || "0"))
              : "N/A"}{" "}
            m³).
          </Typography>
          <Typography paragraph>
            Por favor verifique que la lectura sea correcta y complete la
            información adicional.
          </Typography>

          <FormControl component="fieldset" sx={{ mt: 2 }}>
            <FormLabel component="legend">¿Atendió el cliente?</FormLabel>
            <RadioGroup
              value={lowConsumptionAnsweredDoor ? "yes" : "no"}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setLowConsumptionAnsweredDoor(e.target.value === "yes");
              }}
            >
              <FormControlLabel value="yes" control={<Radio />} label="Sí" />
              <FormControlLabel value="no" control={<Radio />} label="No" />
            </RadioGroup>
          </FormControl>

          {lowConsumptionAnsweredDoor ? (
            <Box sx={{ mt: 2 }}>
              <FormControl component="fieldset" sx={{ mb: 2 }}>
                <FormLabel component="legend">
                  ¿Reportó problemas con el agua?
                </FormLabel>
                <RadioGroup
                  value={lowConsumptionHadIssues ? "yes" : "no"}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    setLowConsumptionHadIssues(e.target.value === "yes");
                  }}
                >
                  <FormControlLabel
                    value="yes"
                    control={<Radio />}
                    label="Sí"
                  />
                  <FormControlLabel value="no" control={<Radio />} label="No" />
                </RadioGroup>
              </FormControl>

              <TextField
                label="¿Cuántos meses viven en la casa?"
                variant="outlined"
                fullWidth
                value={lowConsumptionResidenceMonths}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setLowConsumptionResidenceMonths(e.target.value);
                }}
                type="number"
                sx={{ mt: 2 }}
              />
            </Box>
          ) : (
            <FormControl component="fieldset" sx={{ mt: 2 }}>
              <FormLabel component="legend">
                ¿La casa parece habitada?
              </FormLabel>
              <RadioGroup
                value={lowConsumptionLooksLivedIn ? "yes" : "no"}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setLowConsumptionLooksLivedIn(e.target.value === "yes");
                }}
              >
                <FormControlLabel value="yes" control={<Radio />} label="Sí" />
                <FormControlLabel value="no" control={<Radio />} label="No" />
              </RadioGroup>
            </FormControl>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setShowLowConsumptionDialog(false)}
            color="primary"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleLowConsumptionConfirm}
            color="primary"
            variant="contained"
          >
            Confirmar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Negative Consumption Dialog */}
      <Dialog
        open={showNegativeConsumptionDialog}
        onClose={() => setShowNegativeConsumptionDialog(false)}
      >
        <DialogTitle>Verificar Consumo Negativo</DialogTitle>
        <DialogContent>
          <Typography paragraph color="error">
            La lectura actual ({reading}) es menor que la anterior (
            {reading && previousReading !== "---"
              ? parseFloat(reading) - parseFloat(String(previousReading || "0"))
              : "N/A"}{" "}
            m³).
          </Typography>
          <Typography paragraph>
            Esto resultaría en un consumo negativo (
            {reading && previousReading !== "---"
              ? parseFloat(reading) - parseFloat(String(previousReading || "0"))
              : "N/A"}{" "}
            m³).
          </Typography>
          <Typography paragraph>
            Por favor verifique que la lectura sea correcta.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setShowNegativeConsumptionDialog(false)}
            color="primary"
          >
            Revisar Lectura
          </Button>
          <Button
            onClick={handleNegativeConsumptionConfirm}
            color="error"
            variant="contained"
          >
            Confirmar Lectura
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default MeterScreen;

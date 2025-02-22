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
} from "@mui/material";

function MeterScreen({
  meter,
  currentIndex,
  totalMeters,
  onHome, // function to go home
  onPrev, // function to go to previous meter
  onNext, // function to go to next meter
  onFinish, // function to finish / go to summary
  onReadingChange, // New prop
  onConfirmationChange, // New prop
  showConfirmDialog,
  setShowConfirmDialog,
  pendingNavigation,
  setPendingNavigation,
}) {
  // Create unique keys for this meter's reading and confirmation state
  const readingKey = useMemo(() => `meter_${meter.ID}_reading`, [meter.ID]);
  const confirmedKey = useMemo(() => `meter_${meter.ID}_confirmed`, [meter.ID]);

  // Initialize state from localStorage
  const [reading, setReading] = useState(
    () => localStorage.getItem(readingKey) || ""
  );
  const [isConfirmed, setIsConfirmed] = useState(
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
      const monthToNum = {
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

      // Convert years to numbers for proper comparison
      const numYearA = parseInt(yearA, 10);
      const numYearB = parseInt(yearB, 10);

      // Get month numbers, defaulting to 0 if not found
      const numMonthA = monthToNum[monthA] || 0;
      const numMonthB = monthToNum[monthB] || 0;

      // Create comparable numbers (YYYYMM format)
      const dateNumA = numYearA * 100 + numMonthA;
      const dateNumB = numYearB * 100 + numMonthB;

      return dateNumA - dateNumB;
    });

  // Get the last 5 entries to display
  const recentEntries = previousEntries.slice(-5);

  // Collect previous readings and compute average.
  const previousValues = previousEntries.map(([_, val]) => Number(val) || 0);
  const averageReading = previousValues.length
    ? previousValues.reduce((sum, val) => sum + val, 0) / previousValues.length
    : 0;

  // Memoize the validation function
  const validateReading = useCallback(
    (val) => {
      if (!val.trim()) {
        alert("La lectura no puede estar vacía");
        return false;
      }

      const numVal = Number(val);
      if (isNaN(numVal) || numVal < 0) {
        alert("La lectura debe ser un número no negativo");
        return false;
      }

      // Get the last reading
      const lastReading = previousValues[previousValues.length - 1];

      // Check if reading is lower than last month
      if (lastReading && numVal < lastReading) {
        const msg = `¡Advertencia! La lectura ingresada (${numVal}) es menor que la lectura del mes anterior (${lastReading}). ¿Está seguro que la lectura es correcta?`;
        if (!window.confirm(msg)) {
          return false;
        }
      }

      // Check consumption
      if (lastReading) {
        const currentConsumption = numVal - lastReading;

        // For cases where there has been no consumption (same reading) in previous months
        if (meter.averageConsumption === 0) {
          // Allow small increases (up to 5 units) without warning
          if (currentConsumption > 5) {
            const msg = `El consumo de este mes (${currentConsumption} m³) es significativamente mayor que los meses anteriores donde no hubo consumo. ¿Está seguro?`;
            if (!window.confirm(msg)) {
              return false;
            }
          }
        } else {
          // Skip consumption check only if consumption is very low (≤ 5)
          if (currentConsumption > 5) {
            const isVeryHigh =
              currentConsumption > meter.averageConsumption * 2;
            const isVeryLow =
              currentConsumption < meter.averageConsumption * 0.5;

            if (isVeryHigh || isVeryLow) {
              const msg = `El consumo de este mes (${currentConsumption} m³) es muy diferente del promedio mensual (${meter.averageConsumption} m³). ¿Está seguro?`;
              if (!window.confirm(msg)) {
                return false;
              }
            }
          }
        }
      }

      return true;
    },
    [meter.averageConsumption, meter.ID]
  );

  // Memoize handlers
  const handleReadingChange = useCallback((e) => {
    setReading(e.target.value);
  }, []);

  const handleConfirm = useCallback(() => {
    if (validateReading(reading)) {
      setIsConfirmed(true);
      localStorage.setItem(confirmedKey, "true");
      onConfirmationChange(meter.ID, true);
    }
  }, [reading, confirmedKey, meter.ID, validateReading, onConfirmationChange]);

  const handleEdit = useCallback(() => {
    if (window.confirm("¿Está seguro que desea editar esta lectura?")) {
      setIsConfirmed(false);
      localStorage.setItem(confirmedKey, "false");
      onConfirmationChange(meter.ID, false);
    }
  }, [confirmedKey, meter.ID, onConfirmationChange]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !isConfirmed) {
      handleConfirm();
    }
  };

  // Determine button labels and actions.
  const leftButtonLabel = currentIndex === 0 ? "Inicio" : "Anterior";
  const leftButtonAction = currentIndex === 0 ? onHome : onPrev;
  const rightButtonLabel =
    currentIndex < totalMeters - 1 ? "Siguiente" : "Finalizar";
  const rightButtonAction = currentIndex < totalMeters - 1 ? onNext : onFinish;

  // Update handleNavigationAttempt to use the parent's state
  const handleNavigationAttempt = useCallback(
    (navigationFunction) => {
      if (reading && !isConfirmed) {
        setShowConfirmDialog(true);
        setPendingNavigation(() => navigationFunction);
      } else {
        navigationFunction();
      }
    },
    [reading, isConfirmed, setShowConfirmDialog, setPendingNavigation]
  );

  // Update the handleNavigationConfirm function
  const handleNavigationConfirm = useCallback(
    (shouldConfirmReading) => {
      if (shouldConfirmReading) {
        if (validateReading(reading)) {
          // Update local state and storage
          setIsConfirmed(true);
          localStorage.setItem(confirmedKey, "true");
          onConfirmationChange(meter.ID, true);

          // Navigate immediately
          pendingNavigation();
        }
      } else {
        // Navigate immediately without confirming
        pendingNavigation();
      }

      // Clear dialog state
      setShowConfirmDialog(false);
      setPendingNavigation(null);
    },
    [
      reading,
      validateReading,
      confirmedKey,
      meter.ID,
      onConfirmationChange,
      pendingNavigation,
    ]
  );

  return (
    <>
      <Paper sx={{ p: 3 }}>
        {/* Client Info */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h5" gutterBottom>
            CLIENTE: {meter.ID}
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            {meter.ADDRESS}
          </Typography>
        </Box>

        {/* Previous Readings Grid */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))",
            gap: 2,
            mb: 4,
          }}
        >
          {recentEntries.map(([dateKey, val]) => {
            const [year, month] = dateKey.split("-");
            return (
              <Box
                key={dateKey}
                sx={{
                  textAlign: "center",
                  p: 1.5,
                  borderRadius: 2,
                  background: "linear-gradient(145deg, #f5f5f5, #ffffff)",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                }}
              >
                <Typography
                  variant="subtitle2"
                  sx={{
                    color: "text.secondary",
                    mb: 0.5,
                    fontWeight: 500,
                  }}
                >
                  {month.substring(0, 3)} {year}
                </Typography>
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 600,
                    color: "#1a237e",
                  }}
                >
                  {val}
                </Typography>
              </Box>
            );
          })}
        </Box>

        {/* Average Consumption Card */}
        <Box
          sx={{
            mb: 3,
            p: 2,
            borderRadius: 2,
            background: "linear-gradient(145deg, #f8f9fa, #e9ecef)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          }}
        >
          <Typography
            variant="subtitle2"
            sx={{
              color: "text.secondary",
              mb: 0.5,
              fontWeight: 500,
            }}
          >
            Promedio de Consumo Mensual
          </Typography>
          <Typography
            variant="h5"
            sx={{
              fontWeight: 600,
              color: "#1a237e",
            }}
          >
            {meter.averageConsumption} m³
          </Typography>
        </Box>

        {/* Input Section */}
        <Box sx={{ mb: 4 }}>
          <TextField
            label="Ingrese Lectura Actual"
            type="number"
            value={reading}
            onChange={handleReadingChange}
            onKeyDown={handleKeyDown}
            fullWidth
            sx={{
              mb: 2,
              "& .MuiOutlinedInput-root": {
                fontSize: "1.2rem",
              },
            }}
            disabled={isConfirmed}
          />

          <Box sx={{ display: "flex", justifyContent: "center" }}>
            {!isConfirmed ? (
              <Button
                variant="contained"
                color="success"
                onClick={handleConfirm}
                size="large"
                sx={{ minWidth: 200 }}
              >
                Confirmar
              </Button>
            ) : (
              <Button
                variant="outlined"
                color="warning"
                onClick={handleEdit}
                size="large"
                sx={{ minWidth: 200 }}
              >
                Editar
              </Button>
            )}
          </Box>
        </Box>

        {/* Navigation Buttons */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mt: 2,
          }}
        >
          <Button
            variant="outlined"
            onClick={leftButtonAction}
            sx={{
              minWidth: 100,
              borderColor: "#0A0E17",
              color: "#0A0E17",
              "&:hover": {
                borderColor: "#1B2230",
                backgroundColor: "rgba(10, 14, 23, 0.04)",
              },
            }}
          >
            {leftButtonLabel}
          </Button>

          <Typography variant="body2" color="text.secondary">
            Medidor {currentIndex + 1} de {totalMeters}
          </Typography>

          {currentIndex === totalMeters - 1 ? (
            <Button
              variant="contained"
              onClick={onFinish}
              sx={{
                minWidth: 100,
                backgroundColor: "#0A0E17",
                "&:hover": {
                  backgroundColor: "#1B2230",
                },
              }}
            >
              Revisar
            </Button>
          ) : (
            <Button
              variant="contained"
              onClick={onNext}
              sx={{
                minWidth: 100,
                backgroundColor: "#0A0E17",
                "&:hover": {
                  backgroundColor: "#1B2230",
                },
              }}
            >
              Siguiente
            </Button>
          )}
        </Box>
      </Paper>

      {/* Navigation Confirmation Dialog */}
      <Dialog
        open={showConfirmDialog}
        onClose={() => setShowConfirmDialog(false)}
      >
        <DialogTitle>Lectura Sin Confirmar</DialogTitle>
        <DialogContent>
          <Typography>
            Ha ingresado una lectura pero no la ha confirmado. ¿Qué desea hacer?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => handleNavigationConfirm(false)}
            color="warning"
          >
            Dejar Sin Confirmar
          </Button>
          <Button
            onClick={() => handleNavigationConfirm(true)}
            variant="contained"
            color="success"
          >
            Confirmar Lectura
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default MeterScreen;

import React, { useState, useEffect } from "react";
import { Paper, Typography, Box, Button, TextField } from "@mui/material";

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
}) {
  // Create unique keys for this meter's reading and confirmation state.
  const readingKey = `meter_${meter.ID}_reading`;
  const confirmedKey = `meter_${meter.ID}_confirmed`;

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

  // Persist reading and confirmation state to localStorage whenever they change.
  useEffect(() => {
    localStorage.setItem(readingKey, reading);
    localStorage.setItem(confirmedKey, isConfirmed);
  }, [reading, isConfirmed, readingKey, confirmedKey]);

  // Collect previous readings and compute average.
  const previousEntries = Object.entries(meter.readings)
    .filter(([k]) => k !== "ID")
    .sort((a, b) => a[0].localeCompare(b[0]));

  const previousValues = previousEntries.map(([_, val]) => Number(val) || 0);
  const averageReading = previousValues.length
    ? previousValues.reduce((sum, val) => sum + val, 0) / previousValues.length
    : 0;

  // Validation function for the reading input.
  const validateReading = (val) => {
    if (!val.trim()) {
      alert("La lectura no puede estar vacía");
      return false;
    }
    const numVal = Number(val);
    if (isNaN(numVal) || numVal < 0) {
      alert("La lectura debe ser un número no negativo");
      return false;
    }
    if (
      averageReading > 0 &&
      (numVal > averageReading * 2 || numVal < averageReading * 0.5)
    ) {
      const msg = `La lectura ${numVal} es muy diferente del promedio (${averageReading.toFixed(
        1
      )}). ¿Está seguro?`;
      if (!window.confirm(msg)) {
        return false;
      }
    }
    return true;
  };

  // Update the reading change handler
  const handleReadingChange = (e) => {
    const newReading = e.target.value;
    setReading(newReading);
    localStorage.setItem(readingKey, newReading);
    onReadingChange(meter.ID, newReading); // Notify parent
  };

  const handleConfirm = () => {
    if (validateReading(reading)) {
      setIsConfirmed(true);
      localStorage.setItem(confirmedKey, "true");
      onConfirmationChange(meter.ID, true); // Notify parent
    }
  };

  const handleEdit = () => {
    if (window.confirm("¿Está seguro que desea editar esta lectura?")) {
      setIsConfirmed(false);
      localStorage.setItem(confirmedKey, "false");
      onConfirmationChange(meter.ID, false);
    }
  };

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

  return (
    <Paper
      sx={{
        p: 4, // Increased padding
        mb: 2,
        maxWidth: "800px",
        mx: "auto",
        borderRadius: 2,
        boxShadow: "0 4px 20px rgba(0, 0, 0, 0.1)",
      }}
    >
      {/* Navigation buttons */}
      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 4 }}>
        <Button variant="outlined" onClick={leftButtonAction} size="large">
          {leftButtonLabel}
        </Button>
        <Button variant="contained" onClick={rightButtonAction} size="large">
          {rightButtonLabel}
        </Button>
      </Box>

      {/* Meter Info Section */}
      <Box sx={{ mb: 4 }}>
        <Typography
          variant="h4"
          gutterBottom
          sx={{
            fontWeight: 600,
            color: "#1a237e", // Deep blue color
          }}
        >
          Cliente {meter.ID}
        </Typography>
        <Typography
          variant="h6"
          sx={{
            color: "text.secondary",
            mb: 3,
          }}
        >
          {meter.ADDRESS}
        </Typography>
      </Box>

      {/* Previous Readings Section */}
      <Box
        sx={{
          mb: 4,
          backgroundColor: "#f8f9fa",
          borderRadius: 1,
          p: 3,
        }}
      >
        <Typography
          variant="h6"
          sx={{
            mb: 2,
            fontWeight: 600,
            color: "#2c3e50",
          }}
        >
          Lecturas Anteriores
        </Typography>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))",
            gap: 2,
            mb: 3,
          }}
        >
          {previousEntries.map(([dateKey, val]) => {
            const month = dateKey.split("-")[1];
            return (
              <Box
                key={dateKey}
                sx={{
                  textAlign: "center",
                  p: 1,
                  borderRadius: 1,
                  border: "1px solid #e0e0e0",
                  backgroundColor: "#fff",
                }}
              >
                <Typography
                  variant="subtitle2"
                  sx={{
                    color: "text.secondary",
                    mb: 0.5,
                  }}
                >
                  {month}
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

        {/* Average Reading */}
        {previousValues.length > 0 && (
          <Box
            sx={{
              mt: 2,
              pt: 2,
              borderTop: "1px solid #e0e0e0",
              textAlign: "center",
            }}
          >
            <Typography
              variant="body1"
              sx={{
                color: "text.secondary",
                fontWeight: 500,
              }}
            >
              Promedio (últimas {Math.min(5, previousValues.length)} lecturas)
            </Typography>
            <Typography
              variant="h5"
              sx={{
                color: "#1a237e",
                fontWeight: 600,
                mt: 1,
              }}
            >
              {(
                previousValues.slice(-5).reduce((sum, val) => sum + val, 0) /
                Math.min(5, previousValues.length)
              ).toFixed(1)}
            </Typography>
          </Box>
        )}
      </Box>

      {/* Input Section */}
      <Box sx={{ mt: 4 }}>
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
    </Paper>
  );
}

export default MeterScreen;

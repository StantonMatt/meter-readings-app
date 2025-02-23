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

  // New state for the low consumption dialog
  const [showLowConsumptionDialog, setShowLowConsumptionDialog] =
    useState(false);
  const [lowConsumptionData, setLowConsumptionData] = useState({
    answeredDoor: null,
    hadIssues: null,
    looksLivedIn: null,
    residenceMonths: "",
  });
  const [pendingValidation, setPendingValidation] = useState(null);

  // Add these new states at the top of the component
  const [showNegativeConsumptionDialog, setShowNegativeConsumptionDialog] =
    useState(false);
  const [showHighConsumptionDialog, setShowHighConsumptionDialog] =
    useState(false);
  const [showLowPercentageDialog, setShowLowPercentageDialog] = useState(false);
  const [showHighPercentageDialog, setShowHighPercentageDialog] =
    useState(false);
  const [showUnusualConsumptionDialog, setShowUnusualConsumptionDialog] =
    useState(false);
  const [currentConsumptionData, setCurrentConsumptionData] = useState(null);

  // Add new state for initial low consumption confirmation
  const [showInitialLowConsumptionDialog, setShowInitialLowConsumptionDialog] =
    useState(false);

  // Add new state for edit dialog
  const [showEditDialog, setShowEditDialog] = useState(false);

  // Update the validation function
  const validateReading = useCallback(
    (val) => {
      // Basic validation first
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
      if (!lastReading) return true;

      // Calculate current consumption
      const currentConsumption = numVal - lastReading;
      setCurrentConsumptionData({
        reading: numVal,
        consumption: currentConsumption,
        average: meter.averageConsumption,
      });

      // Very low consumption check (0-3)
      if (currentConsumption >= 0 && currentConsumption <= 3) {
        setShowInitialLowConsumptionDialog(true);
        return false;
      }

      // Negative consumption check
      if (currentConsumption < 0) {
        setShowNegativeConsumptionDialog(true);
        return false;
      }

      // Special handling for clients with zero or very low average consumption
      if (meter.averageConsumption <= 0.1) {
        if (currentConsumption > 5) {
          setShowUnusualConsumptionDialog(true);
          return false;
        }
        return true;
      }

      // Very low consumption compared to average
      if (currentConsumption < meter.averageConsumption * 0.65) {
        setShowLowPercentageDialog(true);
        return false;
      }

      // High consumption check
      if (
        currentConsumption > 10 &&
        currentConsumption > meter.averageConsumption * 1.4
      ) {
        setShowHighPercentageDialog(true);
        return false;
      }

      return true;
    },
    [meter.averageConsumption, previousValues]
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
    setShowEditDialog(true);
  }, []);

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

  const handleLowConsumptionComplete = () => {
    if (lowConsumptionData.answeredDoor === null) {
      alert("Por favor indique si alguien respondió a la puerta");
      return;
    }

    if (lowConsumptionData.answeredDoor) {
      if (lowConsumptionData.hadIssues === null) {
        alert("Por favor indique si reportaron problemas con el agua");
        return;
      }
      if (!lowConsumptionData.residenceMonths) {
        alert("Por favor indique cuántos meses llevan viviendo aquí");
        return;
      }
    } else if (lowConsumptionData.looksLivedIn === null) {
      alert("Por favor indique si la casa parece habitada");
      return;
    }

    // Store verification data in localStorage
    const verificationData = {
      type: "lowConsumption",
      consumption: currentConsumptionData?.consumption,
      details: {
        answeredDoor: lowConsumptionData.answeredDoor,
        ...(lowConsumptionData.answeredDoor
          ? {
              hadIssues: lowConsumptionData.hadIssues,
              residenceMonths: lowConsumptionData.residenceMonths,
            }
          : {
              looksLivedIn: lowConsumptionData.looksLivedIn,
            }),
      },
    };

    localStorage.setItem(
      `meter_${meter.ID}_verification`,
      JSON.stringify(verificationData)
    );

    // Close dialog and proceed with confirmation
    setShowLowConsumptionDialog(false);
    setIsConfirmed(true);
    localStorage.setItem(confirmedKey, "true");
    onConfirmationChange(meter.ID, true);

    // Reset for next time
    setPendingValidation(null);
    setLowConsumptionData({
      answeredDoor: null,
      hadIssues: null,
      looksLivedIn: null,
      residenceMonths: "",
    });
  };

  // Negative consumption dialog confirmation handler update
  const handleNegativeConsumptionConfirm = useCallback(() => {
    setShowNegativeConsumptionDialog(false);
    localStorage.removeItem(`meter_${meter.ID}_verification`);
    setIsConfirmed(true);
    localStorage.setItem(confirmedKey, "true");
    onConfirmationChange(meter.ID, true);
  }, [meter.ID, confirmedKey, onConfirmationChange]);

  // NEW: High consumption dialog confirmation handler (updated)
  const handleHighConsumptionConfirm = useCallback(() => {
    // Immediately clear any verification data for this meter
    console.log(
      "Clearing verification data for high consumption, meter:",
      meter.ID
    );
    localStorage.removeItem(`meter_${meter.ID}_verification`);

    // Set the verification data to "null" (as a string) so that JSON.parse("null") returns null
    localStorage.setItem(`meter_${meter.ID}_verification`, "null");

    setShowHighPercentageDialog(false);
    setIsConfirmed(true);
    localStorage.setItem(confirmedKey, "true");
    onConfirmationChange(meter.ID, true);
  }, [meter.ID, confirmedKey, onConfirmationChange]);

  // Add the initial low consumption dialog
  const initialLowConsumptionDialog = (
    <Dialog
      open={showInitialLowConsumptionDialog}
      onClose={() => setShowInitialLowConsumptionDialog(false)}
      PaperProps={{
        sx: {
          borderRadius: 2,
          borderTop: "4px solid #ff9800", // Warning orange
        },
      }}
    >
      <DialogTitle
        sx={{
          borderBottom: "1px solid rgba(0,0,0,0.08)",
          backgroundColor: "#fff3e0",
          color: "#e65100",
          display: "flex",
          alignItems: "center",
          gap: 1,
        }}
      >
        <Box
          component="span"
          sx={{
            display: "flex",
            alignItems: "center",
            "& svg": { color: "#ff9800", fontSize: 24 },
          }}
        >
          ⚠️
        </Box>
        Consumo Bajo Detectado
      </DialogTitle>
      <DialogContent sx={{ mt: 2 }}>
        <Typography>
          Ha ingresado una lectura que resulta en un consumo de:{" "}
          <Box component="span" sx={{ color: "#ff9800", fontWeight: 600 }}>
            {currentConsumptionData?.consumption} m³
          </Box>
          <br />
          <br />
          Debido al bajo consumo, necesitamos verificar la situación del
          cliente. ¿Desea proceder con la verificación?
        </Typography>
      </DialogContent>
      <DialogActions
        sx={{
          borderTop: "1px solid rgba(0,0,0,0.08)",
          backgroundColor: "#fff3e0",
          px: 2,
          py: 1.5,
        }}
      >
        <Button
          onClick={() => setShowInitialLowConsumptionDialog(false)}
          sx={{ color: "#e65100" }}
        >
          Cancelar
        </Button>
        <Button
          variant="contained"
          onClick={() => {
            setShowInitialLowConsumptionDialog(false);
            setShowLowConsumptionDialog(true);
          }}
          sx={{
            backgroundColor: "#2e7d32", // Green
            "&:hover": {
              backgroundColor: "#1b5e20",
            },
          }}
        >
          Proceder a Verificación
        </Button>
      </DialogActions>
    </Dialog>
  );

  // Add these dialog components before the return statement
  const confirmationDialogs = (
    <>
      <Dialog
        open={showNegativeConsumptionDialog}
        onClose={() => setShowNegativeConsumptionDialog(false)}
        PaperProps={{
          sx: {
            borderRadius: 2,
            borderTop: "4px solid #f44336",
          },
        }}
      >
        <DialogTitle
          sx={{
            borderBottom: "1px solid rgba(0,0,0,0.08)",
            backgroundColor: "#fff3e0",
            color: "#e65100",
            display: "flex",
            alignItems: "center",
            gap: 1,
          }}
        >
          <Box
            component="span"
            sx={{
              display: "flex",
              alignItems: "center",
              "& svg": { color: "#f44336", fontSize: 24 },
            }}
          >
            ⚠️
          </Box>
          Lectura Inferior Detectada
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Typography>
            Ha ingresado una lectura de:{" "}
            <Box component="span" sx={{ color: "darkblue", fontWeight: 600 }}>
              {currentConsumptionData?.reading}
            </Box>{" "}
            <br />
            La cual es inferior a la del mes pasado:{" "}
            <Box component="span" sx={{ color: "darkblue", fontWeight: 600 }}>
              {previousValues[previousValues.length - 1]}
            </Box>
            <br />
            Esto resulta en un consumo negativo de:{" "}
            <Box component="span" sx={{ color: "#f44336", fontWeight: 600 }}>
              {currentConsumptionData?.consumption}
            </Box>
            <br />
            <br />
            ¿Está seguro que la lectura:{" "}
            <Box component="span" sx={{ color: "darkblue", fontWeight: 600 }}>
              {currentConsumptionData?.reading}
            </Box>{" "}
            es correcta?
          </Typography>
        </DialogContent>
        <DialogActions
          sx={{
            borderTop: "1px solid rgba(0,0,0,0.08)",
            backgroundColor: "#fff3e0",
            px: 2,
            py: 1.5,
          }}
        >
          <Button
            onClick={() => setShowNegativeConsumptionDialog(false)}
            sx={{ color: "#e65100" }}
          >
            No, Volver a Editar
          </Button>
          <Button
            variant="contained"
            onClick={handleNegativeConsumptionConfirm}
            sx={{
              backgroundColor: "#2e7d32", // Material-UI's green[800]
              "&:hover": {
                backgroundColor: "#1b5e20", // Material-UI's green[900]
              },
            }}
          >
            Si, Estoy Seguro
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={showHighPercentageDialog}
        onClose={() => setShowHighPercentageDialog(false)}
        PaperProps={{
          sx: {
            borderRadius: 2,
            borderTop: "4px solid #ed6c02", // Warning color for high consumption
          },
        }}
      >
        <DialogTitle
          sx={{
            borderBottom: "1px solid rgba(0,0,0,0.08)",
            backgroundColor: "#fff4e5",
            color: "#663c00",
            display: "flex",
            alignItems: "center",
            gap: 1,
          }}
        >
          Alto Consumo Detectado
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Typography>
            Ha ingresado una lectura que resulta en un consumo
            significativamente alto de:{" "}
            <Box component="span" sx={{ color: "#d32f2f", fontWeight: 600 }}>
              {currentConsumptionData?.consumption} m³
            </Box>
            . Dado que este valor supera notablemente el promedio, ¿desea
            confirmar la lectura sin ningún dato adicional de verificación?
          </Typography>
        </DialogContent>
        <DialogActions
          sx={{
            borderTop: "1px solid rgba(0,0,0,0.08)",
            backgroundColor: "#fff4e5",
            px: 2,
            py: 1.5,
          }}
        >
          <Button
            onClick={() => setShowHighPercentageDialog(false)}
            sx={{ color: "#e65100" }}
          >
            No, Volver a Editar
          </Button>
          <Button
            variant="contained"
            onClick={handleHighConsumptionConfirm}
            sx={{
              backgroundColor: "#2e7d32",
              "&:hover": {
                backgroundColor: "#1b5e20",
              },
            }}
          >
            Confirmar Lectura
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={showLowPercentageDialog}
        onClose={() => setShowLowPercentageDialog(false)}
        PaperProps={{
          sx: { borderRadius: 2 },
        }}
      >
        <DialogTitle
          sx={{
            borderBottom: "1px solid rgba(0,0,0,0.08)",
            backgroundColor: "#f8f9fa",
          }}
        >
          Consumo Bajo Detectado
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Typography>
            El consumo ({currentConsumptionData?.consumption} m³) es muy bajo
            comparado con el promedio mensual ({currentConsumptionData?.average}{" "}
            m³). ¿Está seguro que la lectura es correcta?
          </Typography>
        </DialogContent>
        <DialogActions
          sx={{
            borderTop: "1px solid rgba(0,0,0,0.08)",
            backgroundColor: "#f8f9fa",
          }}
        >
          <Button onClick={() => setShowLowPercentageDialog(false)}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              setShowLowPercentageDialog(false);
              setIsConfirmed(true);
              localStorage.setItem(confirmedKey, "true");
              onConfirmationChange(meter.ID, true);
            }}
          >
            Confirmar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={showUnusualConsumptionDialog}
        onClose={() => setShowUnusualConsumptionDialog(false)}
        PaperProps={{
          sx: { borderRadius: 2 },
        }}
      >
        <DialogTitle
          sx={{
            borderBottom: "1px solid rgba(0,0,0,0.08)",
            backgroundColor: "#f8f9fa",
          }}
        >
          Consumo Inusual Detectado
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Typography>
            ¡Atención! Este cliente normalmente no tiene consumo, pero ahora
            muestra un consumo de {currentConsumptionData?.consumption} m³.
            ¿Está seguro que la lectura es correcta?
          </Typography>
        </DialogContent>
        <DialogActions
          sx={{
            borderTop: "1px solid rgba(0,0,0,0.08)",
            backgroundColor: "#f8f9fa",
          }}
        >
          <Button onClick={() => setShowUnusualConsumptionDialog(false)}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              setShowUnusualConsumptionDialog(false);
              setIsConfirmed(true);
              localStorage.setItem(confirmedKey, "true");
              onConfirmationChange(meter.ID, true);
            }}
          >
            Confirmar
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );

  // Update the lowConsumptionDialog
  const lowConsumptionDialog = (
    <Dialog
      open={showLowConsumptionDialog}
      onClose={() => setShowLowConsumptionDialog(false)}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          borderTop: "4px solid #1a237e", // Deep blue instead of warning orange
        },
      }}
    >
      <DialogTitle
        sx={{
          borderBottom: "1px solid rgba(0,0,0,0.08)",
          backgroundColor: "#f8f9fa",
          color: "#1a237e",
          display: "flex",
          alignItems: "center",
          gap: 1,
        }}
      >
        Verificación de Consumo
      </DialogTitle>
      <DialogContent sx={{ py: 3, backgroundColor: "#fff" }}>
        <Typography
          variant="subtitle1"
          sx={{
            mt: 2,
            mb: 1,
            color: "#1a237e",
            fontWeight: 500,
            fontSize: "1.1rem",
          }}
        >
          Por favor verifique la siguiente información con el cliente:
        </Typography>

        <FormControl component="fieldset" sx={{ width: "100%", mb: 3 }}>
          <FormLabel
            component="legend"
            sx={{
              color: "text.primary",
              fontWeight: 600,
              mb: 1,
              fontSize: "1rem",
            }}
          >
            ¿Le abrieron la puerta?
          </FormLabel>
          <RadioGroup
            value={lowConsumptionData.answeredDoor}
            onChange={(e) =>
              setLowConsumptionData((prev) => ({
                ...prev,
                answeredDoor: e.target.value === "true",
                hadIssues: null,
                looksLivedIn: null,
                residenceMonths: "",
              }))
            }
            sx={{ ml: 1 }}
          >
            <FormControlLabel
              value={true}
              control={<Radio color="primary" />}
              label="Sí"
              sx={{
                "& .MuiFormControlLabel-label": {
                  fontWeight: 500,
                  color: "text.primary",
                },
              }}
            />
            <FormControlLabel
              value={false}
              control={<Radio color="primary" />}
              label="No"
              sx={{
                "& .MuiFormControlLabel-label": {
                  fontWeight: 500,
                  color: "text.primary",
                },
              }}
            />
          </RadioGroup>
        </FormControl>

        {lowConsumptionData.answeredDoor === true && (
          <>
            <FormControl component="fieldset" sx={{ width: "100%", mb: 3 }}>
              <FormLabel
                component="legend"
                sx={{
                  color: "text.primary",
                  fontWeight: 600,
                  mb: 1,
                  fontSize: "1rem",
                }}
              >
                ¿Reportaron problemas con el agua?
              </FormLabel>
              <RadioGroup
                value={lowConsumptionData.hadIssues}
                onChange={(e) =>
                  setLowConsumptionData((prev) => ({
                    ...prev,
                    hadIssues: e.target.value === "true",
                  }))
                }
                sx={{ ml: 1 }}
              >
                <FormControlLabel
                  value={true}
                  control={<Radio color="primary" />}
                  label="Sí"
                  sx={{
                    "& .MuiFormControlLabel-label": {
                      fontWeight: 500,
                      color: "text.primary",
                    },
                  }}
                />
                <FormControlLabel
                  value={false}
                  control={<Radio color="primary" />}
                  label="No"
                  sx={{
                    "& .MuiFormControlLabel-label": {
                      fontWeight: 500,
                      color: "text.primary",
                    },
                  }}
                />
              </RadioGroup>
            </FormControl>

            <FormControl fullWidth sx={{ mb: 3 }}>
              <FormLabel
                sx={{
                  color: "text.primary",
                  fontWeight: 600,
                  mb: 1,
                  fontSize: "1rem",
                }}
              >
                ¿Cuántos meses llevan viviendo ahí?
              </FormLabel>
              <TextField
                type="number"
                value={lowConsumptionData.residenceMonths}
                onChange={(e) =>
                  setLowConsumptionData((prev) => ({
                    ...prev,
                    residenceMonths: e.target.value,
                  }))
                }
                placeholder="Ingrese número de meses"
                size="small"
                color="primary"
                sx={{
                  mt: 1,
                  "& .MuiOutlinedInput-root": {
                    backgroundColor: "#fff",
                  },
                }}
              />
            </FormControl>
          </>
        )}

        {lowConsumptionData.answeredDoor === false && (
          <FormControl component="fieldset" sx={{ width: "100%", mb: 3 }}>
            <FormLabel
              component="legend"
              sx={{
                color: "text.primary",
                fontWeight: 600,
                mb: 1,
                fontSize: "1rem",
              }}
            >
              ¿La casa parece habitada?
            </FormLabel>
            <RadioGroup
              value={lowConsumptionData.looksLivedIn}
              onChange={(e) =>
                setLowConsumptionData((prev) => ({
                  ...prev,
                  looksLivedIn: e.target.value === "true",
                }))
              }
              sx={{ ml: 1 }}
            >
              <FormControlLabel
                value={true}
                control={<Radio color="primary" />}
                label="Sí"
                sx={{
                  "& .MuiFormControlLabel-label": {
                    fontWeight: 500,
                    color: "text.primary",
                  },
                }}
              />
              <FormControlLabel
                value={false}
                control={<Radio color="primary" />}
                label="No"
                sx={{
                  "& .MuiFormControlLabel-label": {
                    fontWeight: 500,
                    color: "text.primary",
                  },
                }}
              />
            </RadioGroup>
          </FormControl>
        )}
      </DialogContent>
      <DialogActions
        sx={{
          px: 3,
          py: 2,
          borderTop: "1px solid rgba(0,0,0,0.08)",
          backgroundColor: "#f8f9fa",
        }}
      >
        <Button
          onClick={() => {
            setShowLowConsumptionDialog(false);
            setPendingValidation(null);
            setLowConsumptionData({
              answeredDoor: null,
              hadIssues: null,
              looksLivedIn: null,
              residenceMonths: "",
            });
          }}
          sx={{
            color: "text.secondary",
            fontWeight: 500,
          }}
        >
          Cancelar
        </Button>
        <Button
          variant="contained"
          onClick={handleLowConsumptionComplete}
          sx={{
            backgroundColor: "#2e7d32",
            "&:hover": {
              backgroundColor: "#1b5e20",
            },
            fontWeight: 500,
          }}
        >
          Confirmar
        </Button>
      </DialogActions>
    </Dialog>
  );

  // Add this to your dialog components
  const editConfirmationDialog = (
    <Dialog
      open={showEditDialog}
      onClose={() => setShowEditDialog(false)}
      PaperProps={{
        sx: {
          borderRadius: 2,
          borderTop: "4px solid #ed6c02", // Warning color
        },
      }}
    >
      <DialogTitle
        sx={{
          borderBottom: "1px solid rgba(0,0,0,0.08)",
          backgroundColor: "#fff4e5",
          color: "#663c00",
          display: "flex",
          alignItems: "center",
          gap: 1,
        }}
      >
        <Box
          component="span"
          sx={{
            display: "flex",
            alignItems: "center",
            "& svg": { color: "#ed6c02", fontSize: 24 },
          }}
        >
          ⚠️
        </Box>
        Confirmar Edición
      </DialogTitle>
      <DialogContent sx={{ mt: 2 }}>
        <Typography>
          ¿Está seguro que desea editar esta lectura?
          <br />
          <br />
          Esta acción le permitirá modificar el valor actual:{" "}
          <Box component="span" sx={{ color: "primary.main", fontWeight: 600 }}>
            {reading}
          </Box>
        </Typography>
      </DialogContent>
      <DialogActions
        sx={{
          borderTop: "1px solid rgba(0,0,0,0.08)",
          backgroundColor: "#fff4e5",
          px: 2,
          py: 1.5,
        }}
      >
        <Button
          onClick={() => setShowEditDialog(false)}
          sx={{ color: "#663c00" }}
        >
          Cancelar
        </Button>
        <Button
          variant="contained"
          onClick={() => {
            setShowEditDialog(false);
            setIsConfirmed(false);
            localStorage.setItem(confirmedKey, "false");
            onConfirmationChange(meter.ID, false);
          }}
          sx={{
            backgroundColor: "#ed6c02",
            "&:hover": {
              backgroundColor: "#c55a00",
            },
          }}
        >
          Si, Editar
        </Button>
      </DialogActions>
    </Dialog>
  );

  return (
    <>
      <Paper
        sx={{
          p: 3,
          maxWidth: "800px", // Add max width constraint
          mx: "auto", // Center the paper
          width: "100%", // Take full width up to maxWidth
        }}
      >
        {/* Client Info */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h5" gutterBottom>
            CLIENTE: {meter.ID}
          </Typography>
          <Typography variant="h4" color="#1a237e">
            {meter.ADDRESS}
          </Typography>
        </Box>

        {/* Previous Readings and Estimates Grid */}
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

        {/* Stats Grid */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: 2,
            mb: 4,
          }}
        >
          {/* Average Consumption Card */}
          <Box
            sx={{
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
              Promedio de Consumo
            </Typography>
            <Typography
              variant="h5"
              sx={{
                fontWeight: 600,
                color: "#1a237e",
              }}
            >
              {meter.averageConsumption}
            </Typography>
          </Box>

          {/* Estimated Reading Card */}
          {meter.estimatedReading !== null && (
            <Box
              sx={{
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
                Lectura Estimada
              </Typography>
              <Typography
                variant="h5"
                sx={{
                  fontWeight: 600,
                  color: "#1a237e",
                  opacity: 0.8,
                }}
              >
                {meter.estimatedReading}
              </Typography>
            </Box>
          )}
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
            mb: 4,
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

        {/* Summary Button */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            borderTop: "1px solid rgba(0, 0, 0, 0.12)",
            pt: 4,
          }}
        >
          <Button
            variant="contained"
            color="primary"
            size="large"
            onClick={onFinish}
            sx={{
              minWidth: 300,
              py: 1.5,
              backgroundColor: "#5048E5",
              "&:hover": {
                backgroundColor: "#4338CA",
              },
            }}
          >
            Ver Resumen de Lecturas
          </Button>
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

      {editConfirmationDialog}
      {initialLowConsumptionDialog}
      {confirmationDialogs}
      {lowConsumptionDialog}
    </>
  );
}

export default MeterScreen;

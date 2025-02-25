// HomeScreen.tsx
import React, { useState } from "react";
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  SelectChangeEvent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  FormControlLabel,
  Checkbox,
  Alert,
} from "@mui/material";
import { MeterData } from "./utils/readingUtils";

interface RouteData {
  id: string;
  name: string;
  totalMeters: number;
  [key: string]: any;
}

interface HomeScreenProps {
  hasReadings: boolean;
  onStart: () => Promise<void>;
  onContinue: () => void;
  onRestart: () => void;
  routes: RouteData[];
  onRouteSelect: (route: RouteData | null) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  selectedRoute: RouteData | null;
  onInitialize: () => Promise<boolean>;
  selectedMonth: number;
  selectedYear: number;
  onDateChange: (month: number, year: number) => void;
  onMeterSelect: (index: number) => void;
  combinedMeters: MeterData[];
  searchResults?: MeterData[];
}

function HomeScreen({
  hasReadings,
  onStart,
  onContinue,
  onRestart,
  routes,
  onRouteSelect,
  isLoading,
  error,
  selectedRoute,
  onInitialize,
  selectedMonth,
  selectedYear,
  onDateChange,
  onMeterSelect,
  combinedMeters,
  searchResults = [],
}: HomeScreenProps): JSX.Element {
  // Get current date
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  // Generate month options
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

  // Function to format the timestamp
  const formatDate = (timestamp: any): string => {
    if (!timestamp) return "";
    // Check if it's a Firestore timestamp
    if (timestamp.seconds) {
      return new Date(timestamp.seconds * 1000).toLocaleDateString();
    }
    // If it's already a string, return it
    if (typeof timestamp === "string") {
      return timestamp;
    }
    // If it's a Date object
    if (timestamp instanceof Date) {
      return timestamp.toLocaleDateString();
    }
    return "";
  };

  const generateYearRange = (): number[] => {
    const startYear = 2020;
    const endYear = currentYear + 1;
    const years = [];
    for (let year = startYear; year <= endYear; year++) {
      years.push(year);
    }
    return years;
  };

  const years = generateYearRange();

  const handleMeterClick = (meter: MeterData): void => {
    // Find the actual index of the meter in the original combinedMeters array
    const meterIndex = combinedMeters.findIndex((m) => m.ID === meter.ID);
    if (meterIndex !== -1) {
      onMeterSelect(meterIndex);
    }
  };

  // Add new state variables for the reset confirmation dialog
  const [isResetDialogOpen, setIsResetDialogOpen] = useState<boolean>(false);
  const [resetConfirmChecked, setResetConfirmChecked] =
    useState<boolean>(false);
  const [resetSuccess, setResetSuccess] = useState<boolean>(false);

  // Add dialog handlers
  const handleOpenResetDialog = () => {
    setIsResetDialogOpen(true);
    setResetConfirmChecked(false); // Reset checkbox state when opening dialog
    setResetSuccess(false); // Reset success message state
  };

  const handleCloseResetDialog = () => {
    setIsResetDialogOpen(false);
    // If we just completed a reset successfully, clear the success message after a delay
    if (resetSuccess) {
      setTimeout(() => setResetSuccess(false), 2000);
    }
  };

  const handleResetConfirm = () => {
    if (resetConfirmChecked) {
      // Clear all reading-related data from localStorage
      const keys = Object.keys(localStorage);
      keys.forEach((key) => {
        // Only clear keys related to meter readings
        if (key.startsWith("meter_")) {
          localStorage.removeItem(key);
        }
      });

      // Also clear the lastViewedMeterIndex from localStorage
      localStorage.removeItem("lastViewedMeterIndex");

      // Call the onRestart prop to let parent component know
      onRestart();

      // Show success message
      setResetSuccess(true);

      // Close dialog after successful reset
      handleCloseResetDialog();
    }
  };

  const handleResetCheckboxChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setResetConfirmChecked(event.target.checked);
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ display: "flex", gap: 2, mb: 3, flexWrap: "wrap" }}>
        <Card sx={{ flex: "1 1 200px" }}>
          <CardContent>
            <Typography variant="overline" color="textSecondary">
              Rutas Disponibles
            </Typography>
            <FormControl fullWidth variant="outlined" sx={{ mt: 2 }}>
              <InputLabel id="route-select-label">Seleccionar Ruta</InputLabel>
              <Select
                labelId="route-select-label"
                id="route-select"
                value={selectedRoute?.id || ""}
                onChange={(e: SelectChangeEvent<string>) => {
                  const routeId = e.target.value;
                  const selectedRoute = routes.find(
                    (route) => route.id === routeId
                  );
                  onRouteSelect(selectedRoute || null);
                }}
                label="Seleccionar Ruta"
                disabled={isLoading}
              >
                <MenuItem value="">
                  <em>Ninguna</em>
                </MenuItem>
                {routes.map((route) => (
                  <MenuItem key={route.id} value={route.id}>
                    {route.name} ({route.totalMeters} medidores)
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {selectedRoute && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="textSecondary">
                  Última actualización: {formatDate(selectedRoute.lastUpdated)}
                </Typography>
              </Box>
            )}

            {error && (
              <Typography
                variant="body2"
                color="error"
                sx={{ mt: 2, fontWeight: "bold" }}
              >
                {error}
              </Typography>
            )}

            <Box
              sx={{
                mt: 3,
                display: "flex",
                flexDirection: "column",
                gap: 1,
              }}
            >
              <Button
                variant="contained"
                onClick={onInitialize}
                disabled={isLoading}
              >
                Inicializar Datos
              </Button>
            </Box>
          </CardContent>
        </Card>

        <Card sx={{ flex: "1 1 200px" }}>
          <CardContent>
            <Typography variant="overline" color="textSecondary">
              Fecha de Lecturas
            </Typography>
            <Box sx={{ mt: 2, display: "flex", gap: 2 }}>
              <FormControl fullWidth variant="outlined">
                <InputLabel id="month-select-label">Mes</InputLabel>
                <Select
                  labelId="month-select-label"
                  id="month-select"
                  value={selectedMonth}
                  onChange={(e: SelectChangeEvent<number>) => {
                    const monthIndex = e.target.value as number;
                    onDateChange(monthIndex, selectedYear);
                  }}
                  label="Mes"
                  disabled={isLoading}
                >
                  {months.map((month, index) => (
                    <MenuItem key={month} value={index}>
                      {month}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth variant="outlined">
                <InputLabel id="year-select-label">Año</InputLabel>
                <Select
                  labelId="year-select-label"
                  id="year-select"
                  value={selectedYear}
                  onChange={(e: SelectChangeEvent<number>) => {
                    const year = e.target.value as number;
                    onDateChange(selectedMonth, year);
                  }}
                  label="Año"
                  disabled={isLoading}
                >
                  {years.map((year) => (
                    <MenuItem key={year} value={year}>
                      {year}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            <Typography variant="body2" sx={{ mt: 2, fontSize: "0.9rem" }}>
              Seleccione el mes y año para las lecturas.
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {/* If there are search results show them */}
      {searchResults && searchResults.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="overline" color="textSecondary">
              Resultados de búsqueda ({searchResults.length})
            </Typography>
            <Box
              sx={{
                mt: 2,
                display: "flex",
                flexDirection: "column",
                gap: 1,
              }}
            >
              {searchResults.map((meter) => (
                <Button
                  key={meter.ID}
                  variant="outlined"
                  onClick={() => handleMeterClick(meter)}
                  sx={{ justifyContent: "flex-start", textAlign: "left" }}
                >
                  <Box sx={{ display: "flex", flexDirection: "column" }}>
                    <Typography variant="subtitle1">{meter.ID}</Typography>
                    <Typography
                      variant="body2"
                      color="textSecondary"
                      sx={{ fontSize: "0.85rem" }}
                    >
                      {meter.ADDRESS}
                    </Typography>
                  </Box>
                </Button>
              ))}
            </Box>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Lecturas de Medidores
          </Typography>

          {/* Context: 80 character in order to determine line wrapping
          1234567890123456789012345678901234567890123456789012345678901234567890123456789 */}
          <Typography variant="body1" paragraph>
            Esta aplicación le permite registrar y gestionar lecturas de
            medidores de agua.
          </Typography>

          <Box sx={{ mt: 3, display: "flex", gap: 2, flexWrap: "wrap" }}>
            {hasReadings ? (
              <>
                <Button
                  variant="outlined"
                  onClick={handleOpenResetDialog}
                  disabled={isLoading}
                >
                  Reiniciar Lecturas
                </Button>
                <Button
                  variant="contained"
                  onClick={onContinue}
                  disabled={isLoading}
                >
                  Continuar Lecturas
                </Button>
              </>
            ) : (
              <Button
                variant="contained"
                onClick={onStart}
                disabled={isLoading}
              >
                {isLoading ? "Cargando..." : "Iniciar Lecturas"}
              </Button>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* Reset Confirmation Dialog */}
      <Dialog
        open={isResetDialogOpen}
        onClose={handleCloseResetDialog}
        aria-labelledby="reset-dialog-title"
        aria-describedby="reset-dialog-description"
      >
        <DialogTitle id="reset-dialog-title">
          ¿Reiniciar todas las lecturas?
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="reset-dialog-description">
            Esta acción eliminará todas las lecturas actuales y no se podrán
            recuperar. Todos los datos no enviados se perderán permanentemente.
          </DialogContentText>
          <Box sx={{ mt: 2 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={resetConfirmChecked}
                  onChange={handleResetCheckboxChange}
                  color="primary"
                />
              }
              label="Entiendo que esta acción no se puede deshacer"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseResetDialog} color="primary">
            Cancelar
          </Button>
          <Button
            onClick={handleResetConfirm}
            color="error"
            disabled={!resetConfirmChecked}
            variant="contained"
          >
            Reiniciar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Success snackbar or alert */}
      {resetSuccess && (
        <Box sx={{ mt: 2 }}>
          <Alert severity="success" onClose={() => setResetSuccess(false)}>
            Todas las lecturas han sido reiniciadas correctamente.
          </Alert>
        </Box>
      )}
    </Container>
  );
}

export default HomeScreen;

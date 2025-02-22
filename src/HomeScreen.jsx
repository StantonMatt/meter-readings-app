// HomeScreen.jsx
import React from "react";
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
} from "@mui/material";

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
}) {
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
  const formatDate = (timestamp) => {
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

  const generateYearRange = () => {
    const startYear = 2020;
    const endYear = currentYear + 1;
    const years = [];
    for (let year = startYear; year <= endYear; year++) {
      years.push(year);
    }
    return years;
  };

  const years = generateYearRange();

  return (
    <Container maxWidth="lg">
      <Box sx={{ display: "flex", gap: 2, mb: 3, flexWrap: "wrap" }}>
        <Card sx={{ flex: "1 1 200px" }}>
          <CardContent>
            <Typography variant="overline" color="textSecondary">
              Rutas Disponibles
            </Typography>
            <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mt: 2 }}>
              {isLoading ? (
                <Typography>Cargando rutas...</Typography>
              ) : error ? (
                <Typography color="error">{error}</Typography>
              ) : routes && routes.length > 0 ? (
                routes.map((route) => (
                  <Box
                    key={route.id}
                    sx={{
                      position: "relative",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 1,
                    }}
                  >
                    <Button
                      variant={
                        selectedRoute?.id === route.id
                          ? "contained"
                          : "outlined"
                      }
                      onClick={() => !selectedRoute && onRouteSelect(route)}
                      sx={{
                        mb: 1,
                        backgroundColor:
                          selectedRoute?.id === route.id
                            ? "#4B5563"
                            : "transparent",
                        color:
                          selectedRoute?.id === route.id ? "white" : "inherit",
                        opacity: selectedRoute?.id === route.id ? 1 : 1,
                        pointerEvents:
                          selectedRoute?.id === route.id ? "none" : "auto",
                        "&:hover": {
                          backgroundColor:
                            selectedRoute?.id === route.id
                              ? "#4B5563"
                              : "rgba(0, 0, 0, 0.04)",
                        },
                      }}
                    >
                      {route.name} ({formatDate(route.lastUpdated)})
                    </Button>
                    {selectedRoute?.id === route.id && (
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRouteSelect(null);
                        }}
                        sx={{
                          minWidth: "36px",
                          width: "36px",
                          height: "36px",
                          p: 0,
                          borderRadius: "50%",
                          color: "error.main",
                          fontSize: "28px",
                          fontWeight: "bold",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          mb: 1,
                          "&:hover": {
                            backgroundColor: "error.light",
                            color: "white",
                          },
                        }}
                      >
                        ×
                      </Button>
                    )}
                  </Box>
                ))
              ) : (
                <Typography color="text.secondary">
                  No hay rutas disponibles
                </Typography>
              )}
            </Box>
          </CardContent>
        </Card>
      </Box>

      <Box sx={{ display: "flex", gap: 2, mb: 3 }}>
        <FormControl sx={{ minWidth: 120 }}>
          <InputLabel>Month</InputLabel>
          <Select
            value={selectedMonth || currentMonth}
            onChange={(e) => onDateChange(e.target.value, selectedYear)}
            label="Month"
          >
            {months.map((month, index) => (
              <MenuItem key={month} value={index}>
                {month}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl sx={{ minWidth: 120 }}>
          <InputLabel>Year</InputLabel>
          <Select
            value={selectedYear || currentYear}
            onChange={(e) => onDateChange(selectedMonth, e.target.value)}
            label="Year"
          >
            {years.map((year) => (
              <MenuItem key={year} value={year}>
                {year}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      <Box sx={{ mt: 2, mb: 2 }}>
        <Button
          variant="contained"
          color="secondary"
          onClick={onInitialize}
          sx={{ mr: 2 }}
        >
          Initialize Route & Readings Data
        </Button>
      </Box>

      <Card>
        <CardContent>
          <Typography variant="h4" gutterBottom>
            COAB Lectura de Medidores
          </Typography>
          <Typography variant="body1" sx={{ mb: 2 }}>
            {selectedRoute
              ? `Ruta seleccionada: ${selectedRoute.name}`
              : "Por favor seleccione una ruta para comenzar"}
          </Typography>
          <Box sx={{ display: "flex", gap: 2, justifyContent: "center" }}>
            {hasReadings ? (
              <>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={onContinue}
                  disabled={!selectedRoute}
                >
                  CONTINUAR
                </Button>
                <Button variant="outlined" color="error" onClick={onRestart}>
                  REINICIAR
                </Button>
              </>
            ) : (
              <Button
                variant="contained"
                color="primary"
                onClick={onStart}
                disabled={!selectedRoute || isLoading}
              >
                {isLoading ? "Cargando..." : "COMENZAR"}
              </Button>
            )}
          </Box>
        </CardContent>
      </Card>
    </Container>
  );
}

export default HomeScreen;

import React, { useState, useMemo, useEffect } from "react";
import {
  Container,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Box,
  Chip,
  Button,
  Alert,
  List,
  ListItem,
  ListItemText,
  Divider,
} from "@mui/material";
import { MeterData, ReadingsState } from "./utils/readingUtils";

interface SummaryScreenProps {
  meters: MeterData[];
  readingsState: ReadingsState;
  setReadingsState?: React.Dispatch<React.SetStateAction<ReadingsState>>;
  onFinalize: () => Promise<void>;
  onBack: () => void;
  onSelectMeter: (index: number) => void;
  selectedMonth?: number;
  selectedYear?: number;
}

interface SummaryStats {
  confirmed: number;
  pending: number;
  skipped: number;
  total: number;
  completionPercentage: number;
}

function SummaryScreen({
  meters,
  readingsState,
  setReadingsState,
  onFinalize,
  onBack,
  onSelectMeter,
  selectedMonth,
  selectedYear,
}: SummaryScreenProps): JSX.Element {
  // Calculate reading statistics
  const stats: SummaryStats = useMemo(() => {
    const confirmed = meters.filter(
      (meter) => readingsState[meter.ID]?.isConfirmed
    ).length;

    const pending = meters.filter(
      (meter) =>
        readingsState[meter.ID]?.reading &&
        !readingsState[meter.ID]?.isConfirmed
    ).length;

    const skipped = meters.length - confirmed - pending;
    const completionPercentage = Math.round((confirmed / meters.length) * 100);

    return {
      confirmed,
      pending,
      skipped,
      total: meters.length,
      completionPercentage,
    };
  }, [meters, readingsState]);

  // Generate data rows for the table
  const rows = useMemo(() => {
    console.log("Creating rows with meters:", meters);

    return meters.map((meter) => {
      const reading = readingsState[meter.ID];
      const readingValue = reading?.reading || meter.currentReading || "---";
      const isConfirmed = reading?.isConfirmed || meter.isConfirmed || false;

      // Use the previousReading and consumption directly from the meter object if available
      const previousReading = meter.previousReading || "---";
      const consumption = meter.consumption || "---";

      return {
        id: meter.ID,
        address: meter.ADDRESS,
        previousReading,
        currentReading: readingValue,
        consumption,
        status:
          readingValue !== "---"
            ? isConfirmed
              ? "confirmed"
              : "pending"
            : "skipped",
      };
    });
  }, [meters, readingsState]);

  // Add debugging to see what data we're working with
  useEffect(() => {
    console.log("Summary Screen Data:");
    console.log("Meters:", meters);
    console.log("ReadingsState:", readingsState);
    console.log("Generated Rows:", rows);
  }, [meters, readingsState, rows]);

  // Simplify the reset function to act immediately without confirmation
  const handleResetReading = (meterId: string | number) => {
    if (!setReadingsState) return;

    // Directly reset the reading without showing a confirmation dialog
    const newReadingsState = { ...readingsState };
    delete newReadingsState[meterId];
    setReadingsState(newReadingsState);

    // Also remove from localStorage
    localStorage.removeItem(`meter_${meterId}_reading`);
    localStorage.removeItem(`meter_${meterId}_confirmed`);
    localStorage.removeItem(`meter_${meterId}_verification`);
  };

  // Format the month name
  const getMonthName = (monthIndex?: number): string => {
    if (monthIndex === undefined) return "";

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
    return months[monthIndex];
  };

  // Calculate average consumption from the data
  const averageConsumption = useMemo(() => {
    // Get all valid consumption values
    const consumptionValues = rows
      .map((row) =>
        row.consumption !== "---" ? parseFloat(row.consumption) : null
      )
      .filter((value) => value !== null && value > 0);

    // Calculate average if we have values
    if (consumptionValues.length > 0) {
      const sum = consumptionValues.reduce((acc, val) => acc + (val || 0), 0);
      return sum / consumptionValues.length;
    }

    // Default value if no data
    return 15;
  }, [rows]);

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Resumen de Lecturas
        </Typography>
        {selectedMonth !== undefined && selectedYear && (
          <Typography variant="subtitle1" color="text.secondary" gutterBottom>
            {getMonthName(selectedMonth)} {selectedYear}
          </Typography>
        )}
      </Box>

      {/* Stats Cards */}
      <Box
        sx={{
          display: "flex",
          gap: 2,
          mb: 4,
          flexWrap: "wrap",
        }}
      >
        <Paper
          elevation={1}
          sx={{
            p: 2,
            flex: "1 1 150px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <Typography variant="h6" gutterBottom>
            Lecturas
          </Typography>
          <Typography variant="h3">{stats.confirmed}</Typography>
          <Typography variant="body2" color="text.secondary">
            de {stats.total} confirmadas
          </Typography>
        </Paper>

        <Paper
          elevation={1}
          sx={{
            p: 2,
            flex: "1 1 150px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            bgcolor: stats.pending > 0 ? "warning.light" : undefined,
          }}
        >
          <Typography variant="h6" gutterBottom>
            Pendientes
          </Typography>
          <Typography variant="h3">{stats.pending}</Typography>
          <Typography variant="body2" color="text.secondary">
            sin confirmar
          </Typography>
        </Paper>

        <Paper
          elevation={1}
          sx={{
            p: 2,
            flex: "1 1 150px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <Typography variant="h6" gutterBottom>
            Completado
          </Typography>
          <Typography variant="h3">{stats.completionPercentage}%</Typography>
          <Typography variant="body2" color="text.secondary">
            {stats.skipped} omitidas
          </Typography>
        </Paper>
      </Box>

      {/* Alert if there are pending readings */}
      {stats.pending > 0 && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          Hay {stats.pending} lecturas pendientes de confirmar. Se recomienda
          confirmar todas las lecturas antes de finalizar.
        </Alert>
      )}

      {/* Table of all readings */}
      <TableContainer component={Paper} sx={{ mb: 4 }}>
        <Table sx={{ minWidth: 650 }} aria-label="tabla de lecturas">
          <TableHead>
            <TableRow>
              <TableCell>Medidor</TableCell>
              <TableCell>Dirección</TableCell>
              <TableCell align="right">Lectura Anterior</TableCell>
              <TableCell align="right">Lectura Actual</TableCell>
              <TableCell align="right">Consumo (m³)</TableCell>
              <TableCell align="center">Estado</TableCell>
              <TableCell align="center">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row, index) => {
              // Determine consumption status for styling
              let consumptionStatus = "normal";
              let consumptionLabel = "";

              // Check if this was an estimated reading
              const isEstimated = localStorage.getItem(
                `meter_${row.id}_verification`
              )
                ? JSON.parse(
                    localStorage.getItem(`meter_${row.id}_verification`) || "{}"
                  ).type === "cantRead"
                : false;

              if (row.consumption !== "---") {
                const consumptionValue = parseFloat(row.consumption);

                // Only apply consumption status labels for non-estimated readings
                if (!isEstimated) {
                  if (consumptionValue < 0) {
                    consumptionStatus = "negative";
                    consumptionLabel = "Negativo";
                  } else if (consumptionValue < 4) {
                    consumptionStatus = "low";
                    consumptionLabel = "Bajo";
                  } else if (consumptionValue > 20) {
                    consumptionStatus = "high";
                    consumptionLabel = "Elevado";
                  }
                }
              }

              return (
                <TableRow
                  key={row.id}
                  sx={{
                    "&:last-child td, &:last-child th": { border: 0 },
                    bgcolor: isEstimated
                      ? "rgba(79, 70, 229, 0.2)" // Purple for estimated
                      : row.status === "pending"
                      ? "rgba(255, 152, 0, 0.2)" // Orange/yellow for pending
                      : consumptionStatus === "negative"
                      ? "rgba(185, 28, 28, 0.2)" // Clearer red for negative consumption
                      : consumptionStatus === "low"
                      ? "rgba(59, 130, 246, 0.2)" // Blue for low consumption
                      : consumptionStatus === "high"
                      ? "rgba(75, 85, 99, 0.2)" // Dark gray for high consumption
                      : undefined, // White for normal confirmed readings
                  }}
                >
                  <TableCell component="th" scope="row">
                    {row.id}
                  </TableCell>
                  <TableCell>{row.address}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 500 }}>
                    {row.previousReading}
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      fontWeight: 600,
                      color: isEstimated
                        ? "rgba(79, 70, 229, 0.9)" // Darker purple for estimated text
                        : "text.primary", // Default text color for normal readings
                    }}
                  >
                    {row.currentReading}
                  </TableCell>
                  <TableCell align="right">
                    <Typography
                      sx={{
                        fontWeight: 600,
                        color:
                          consumptionStatus === "negative"
                            ? "rgba(185, 28, 28, 0.9)" // Clearer red for negative text
                            : consumptionStatus === "low"
                            ? "rgba(37, 99, 235, 0.9)" // Darker blue for low
                            : consumptionStatus === "high"
                            ? "rgba(55, 65, 81, 0.9)" // Darker gray for high
                            : "text.primary", // Default text color for normal
                      }}
                    >
                      {row.consumption}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={
                        row.status === "confirmed"
                          ? "Confirmada"
                          : row.status === "pending"
                          ? "Pendiente"
                          : "Omitida"
                      }
                      color={
                        row.status === "confirmed"
                          ? "success"
                          : row.status === "pending"
                          ? "warning"
                          : "default"
                      }
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Button
                      size="small"
                      onClick={() => onSelectMeter(index)}
                      color="primary"
                      variant="contained"
                      sx={{
                        minWidth: "80px",
                        boxShadow: 1,
                        "&:hover": {
                          boxShadow: 2,
                          transform: "translateY(-1px)",
                        },
                        transition: "all 0.2s",
                      }}
                    >
                      Editar
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Action buttons */}
      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 4 }}>
        <Button variant="outlined" onClick={onBack}>
          Volver
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={() => {
            if (stats.confirmed > 0) {
              onFinalize();
            }
          }}
          disabled={stats.confirmed === 0}
        >
          Finalizar y Enviar
        </Button>
      </Box>

      {/* Color Legend with more distinguishable colors */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle1" gutterBottom>
          Leyenda de Colores:
        </Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <Box
              sx={{
                width: 16,
                height: 16,
                backgroundColor: "rgba(255, 152, 0, 0.2)", // Orange for pending
                border: "1px solid rgba(255, 152, 0, 0.5)",
                borderRadius: 1,
                mr: 1,
              }}
            />
            <Typography variant="body2">Pendiente</Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <Box
              sx={{
                width: 16,
                height: 16,
                backgroundColor: "rgba(79, 70, 229, 0.2)", // Purple for estimated
                border: "1px solid rgba(79, 70, 229, 0.5)",
                borderRadius: 1,
                mr: 1,
              }}
            />
            <Typography variant="body2">Estimada</Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <Box
              sx={{
                width: 16,
                height: 16,
                backgroundColor: "rgba(185, 28, 28, 0.2)", // Clearer red for negative consumption
                border: "1px solid rgba(185, 28, 28, 0.5)",
                borderRadius: 1,
                mr: 1,
              }}
            />
            <Typography variant="body2">Consumo Negativo</Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <Box
              sx={{
                width: 16,
                height: 16,
                backgroundColor: "rgba(59, 130, 246, 0.2)", // Blue for low consumption
                border: "1px solid rgba(59, 130, 246, 0.5)",
                borderRadius: 1,
                mr: 1,
              }}
            />
            <Typography variant="body2">Consumo Bajo</Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <Box
              sx={{
                width: 16,
                height: 16,
                backgroundColor: "rgba(75, 85, 99, 0.2)", // Dark gray for high consumption
                border: "1px solid rgba(75, 85, 99, 0.5)",
                borderRadius: 1,
                mr: 1,
              }}
            />
            <Typography variant="body2">Consumo Elevado</Typography>
          </Box>
        </Box>
      </Box>
    </Container>
  );
}

export default SummaryScreen;

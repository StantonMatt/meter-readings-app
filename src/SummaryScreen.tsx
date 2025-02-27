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
            {rows.map((row, index) => (
              <TableRow
                key={row.id}
                sx={{
                  "&:last-child td, &:last-child th": { border: 0 },
                  bgcolor:
                    row.status === "pending"
                      ? "rgba(255, 152, 0, 0.08)"
                      : undefined,
                }}
              >
                <TableCell component="th" scope="row">
                  {row.id}
                </TableCell>
                <TableCell>{row.address}</TableCell>
                <TableCell align="right">{row.previousReading}</TableCell>
                <TableCell align="right">{row.currentReading}</TableCell>
                <TableCell align="right">{row.consumption}</TableCell>
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
                  <Box
                    sx={{ display: "flex", gap: 1, justifyContent: "center" }}
                  >
                    <Button
                      size="small"
                      onClick={() => onSelectMeter(index)}
                      color="primary"
                    >
                      Editar
                    </Button>
                    {(row.status === "confirmed" ||
                      row.status === "pending") && (
                      <Button
                        size="small"
                        onClick={() => handleResetReading(row.id)}
                        color="error"
                      >
                        Resetear
                      </Button>
                    )}
                  </Box>
                </TableCell>
              </TableRow>
            ))}
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
    </Container>
  );
}

export default SummaryScreen;

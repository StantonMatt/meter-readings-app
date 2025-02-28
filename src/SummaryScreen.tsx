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
import {
  MeterData,
  ReadingsState,
  getMeterReading,
} from "./utils/readingUtils";
import { alpha } from "@mui/material/styles";
import { useTheme } from "@mui/material/styles";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import WarningIcon from "@mui/icons-material/Warning";

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
  const theme = useTheme();

  // Calculate reading statistics
  const stats: SummaryStats = useMemo(() => {
    const confirmed = meters.filter(
      (meter) => readingsState[meter.ID]?.isConfirmed
    ).length;

    // Consider any meter that's not confirmed as pending (no more "skipped" category)
    const pending = meters.length - confirmed;

    // Calculate completion percentage based on confirmed readings
    const completionPercentage = Math.round((confirmed / meters.length) * 100);

    return {
      confirmed,
      pending,
      total: meters.length,
      completionPercentage,
    };
  }, [meters, readingsState]);

  // Generate data rows for the table
  const rows = useMemo(() => {
    console.log("Creating rows with meters:", meters);

    return meters.map((meter) => {
      const meterData = getMeterReading(meter.ID);
      const reading = readingsState[meter.ID];
      const readingValue =
        reading?.reading || (meter as any).currentReading || "---";
      const isConfirmed =
        reading?.isConfirmed || (meter as any).isConfirmed || false;

      const previousReading = (meter as any).previousReading || "---";
      const consumption = meterData?.consumption || {
        type: "normal",
        label: "Normal",
        value: parseFloat((meter as any).consumption || "0"),
      };

      return {
        id: meter.ID,
        address: meter.ADDRESS,
        previousReading,
        currentReading: readingValue,
        consumption: consumption.value.toFixed(1),
        consumptionType: consumption,
        status:
          readingValue !== "---"
            ? isConfirmed
              ? "confirmed"
              : "pending"
            : "pending",
        isConfirmed,
        isEstimated: consumption.type === "estimated",
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
      .filter((value): value is number => value !== null && value > 0);

    // Calculate average if we have values
    if (consumptionValues.length > 0) {
      const sum = consumptionValues.reduce((acc, val) => acc + val, 0);
      return sum / consumptionValues.length;
    }

    // Default value if no data
    return 15;
  }, [rows]);

  return (
    <Container maxWidth="lg" sx={{ py: 4, position: "relative" }}>
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
            del total
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

      {/* Fixed position buttons */}
      <Box
        sx={{
          position: "fixed",
          bottom: 20,
          left: 0,
          right: 0,
          zIndex: 10,
          display: "flex",
          justifyContent: "space-between",
          px: 4,
        }}
      >
        <Button
          variant="outlined"
          onClick={onBack}
          sx={{
            backgroundColor: "white",
            boxShadow: 2,
            "&:hover": {
              backgroundColor: "white",
              boxShadow: 3,
            },
          }}
        >
          Volver
        </Button>
        <Button
          variant="contained"
          color="success"
          onClick={() => {
            if (stats.confirmed > 0) {
              onFinalize();
            }
          }}
          disabled={stats.confirmed === 0}
          sx={{
            boxShadow: 2,
            "&:hover": {
              boxShadow: 3,
            },
          }}
        >
          Finalizar y Enviar
        </Button>
      </Box>

      {/* Table Container */}
      <TableContainer component={Paper} sx={{ mb: 10 }}>
        {" "}
        {/* Add bottom margin for fixed buttons */}
        <Table sx={{ minWidth: 650 }} aria-label="simple table">
          <TableHead>
            <TableRow>
              <TableCell>Medidor</TableCell>
              <TableCell>Dirección</TableCell>
              <TableCell align="right">Lectura Anterior</TableCell>
              <TableCell align="right">Lectura Actual</TableCell>
              <TableCell align="right">Consumo (m³)</TableCell>
              <TableCell align="center">Confirmado</TableCell>
              <TableCell align="center">Lectura</TableCell>
              <TableCell align="center">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row, index) => {
              return (
                <TableRow
                  key={row.id}
                  sx={{
                    "&:last-child td, &:last-child th": { border: 0 },
                  }}
                >
                  <TableCell component="th" scope="row">
                    {row.id}
                  </TableCell>
                  <TableCell>{row.address}</TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      fontWeight: 600,
                      color: "text.primary",
                      fontSize: "0.9rem",
                    }}
                  >
                    {row.previousReading}
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      fontWeight: 600,
                      color: "text.primary",
                      fontSize: "0.9rem",
                    }}
                  >
                    {row.currentReading}
                  </TableCell>
                  <TableCell align="right">
                    <Typography
                      sx={{
                        fontWeight: 600,
                        color: () => {
                          // Use the stored consumption type
                          switch (row.consumptionType.type) {
                            case "estimated":
                              return "rgba(79, 70, 229, 0.9)"; // Purple for estimated
                            case "negative":
                              return theme.palette.error.main;
                            case "low":
                              return theme.palette.info.main;
                            case "high":
                              return theme.palette.text.secondary;
                            default:
                              return theme.palette.text.primary;
                          }
                        },
                        fontSize: "0.9rem",
                        px: 1,
                        py: 0.5,
                        borderRadius: 1,
                        display: "inline-block",
                        backgroundColor: () => {
                          // Use the stored consumption type
                          switch (row.consumptionType.type) {
                            case "estimated":
                              return "rgba(79, 70, 229, 0.05)"; // Light purple bg
                            case "negative":
                              return "rgba(239, 68, 68, 0.05)"; // Light red bg
                            case "low":
                              return "rgba(59, 130, 246, 0.05)"; // Light blue bg
                            case "high":
                              return "rgba(107, 114, 128, 0.05)"; // Light gray bg
                            default:
                              return "transparent";
                          }
                        },
                      }}
                    >
                      {row.consumption}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    {row.isConfirmed ? (
                      <CheckCircleIcon color="success" sx={{ fontSize: 24 }} />
                    ) : (
                      <CancelIcon color="error" sx={{ fontSize: 24 }} />
                    )}
                  </TableCell>
                  <TableCell align="center">
                    <Box
                      sx={{
                        display: "flex",
                        gap: 0.5,
                        flexWrap: "wrap",
                        justifyContent: "center",
                      }}
                    >
                      {/* Status chips - without the "Confirmado" chip */}
                      {!row.isConfirmed && (
                        <Chip label="Pendiente" color="warning" size="small" />
                      )}

                      {/* Show consumption status tag if applicable and confirmed */}
                      {row.isConfirmed && (
                        <Chip
                          icon={(() => {
                            switch (row.consumptionType.type) {
                              case "estimated":
                                return <InfoOutlinedIcon fontSize="small" />;
                              case "negative":
                                return <ErrorOutlineIcon fontSize="small" />;
                              case "low":
                                return <InfoOutlinedIcon fontSize="small" />;
                              case "high":
                                return <WarningIcon fontSize="small" />;
                              default:
                                return <CheckCircleIcon fontSize="small" />;
                            }
                          })()}
                          label={row.consumptionType.label}
                          color={(() => {
                            switch (row.consumptionType.type) {
                              case "estimated":
                                return undefined; // Use custom color for high consumption
                              case "negative":
                                return "error";
                              case "low":
                                return "info";
                              case "high":
                                return undefined; // Use custom color for high consumption
                              default:
                                return "success";
                            }
                          })()}
                          sx={
                            row.consumptionType.type === "estimated"
                              ? {
                                  backgroundColor: "rgba(79, 70, 229, 0.1)",
                                  color: "rgba(79, 70, 229, 0.9)",
                                  borderColor: "rgba(79, 70, 229, 0.3)",
                                  fontWeight: 600,
                                }
                              : row.consumptionType.type === "high"
                              ? {
                                  backgroundColor: alpha(
                                    theme.palette.grey[500],
                                    0.1
                                  ),
                                  color: theme.palette.grey[700],
                                  borderColor: alpha(
                                    theme.palette.grey[500],
                                    0.3
                                  ),
                                  fontWeight: 600,
                                }
                              : undefined
                          }
                          size="small"
                        />
                      )}
                    </Box>
                  </TableCell>
                  <TableCell align="center">
                    <Button
                      size="small"
                      onClick={() => onSelectMeter(index)}
                      color="primary"
                      variant="outlined"
                      sx={{
                        minWidth: "80px",
                        "&:hover": {
                          backgroundColor: alpha(
                            theme.palette.primary.main,
                            0.05
                          ),
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
    </Container>
  );
}

export default SummaryScreen;

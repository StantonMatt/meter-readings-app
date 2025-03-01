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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
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
import WarningIcon from "@mui/icons-material/Warning";
import CalculateOutlinedIcon from "@mui/icons-material/CalculateOutlined";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import WaterDropIcon from "@mui/icons-material/WaterDrop";
import PriorityHighIcon from "@mui/icons-material/PriorityHigh";
import { palette } from "./theme";

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
  onFinalize,
  onBack,
  onSelectMeter,
  selectedMonth,
  selectedYear,
}: SummaryScreenProps): JSX.Element {
  const theme = useTheme();

  // Add state for showing normal readings (near the top of the component)
  const [showNormalReadings, setShowNormalReadings] = useState<boolean>(false);
  // Add state for finalize confirmation dialog
  const [showFinalizeDialog, setShowFinalizeDialog] = useState<boolean>(false);

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

      // If there's no reading or it's not confirmed, mark as pending
      if (!isConfirmed) {
        return {
          id: meter.ID,
          address: meter.ADDRESS,
          previousReading,
          currentReading: readingValue,
          consumption: readingValue,
          consumptionType: { type: "pending", label: "Pendiente", value: 0 },
          status: "pending",
          isConfirmed,
          isEstimated: false,
        };
      }

      // Only calculate consumption type if the reading is confirmed
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
        consumption: isNaN(consumption.value)
          ? "---"
          : consumption.value.toFixed(1),
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

  // Add a function to filter rows
  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (!showNormalReadings && row.consumptionType.type === "normal") {
        return false;
      }
      return true;
    });
  }, [rows, showNormalReadings]);

  // Add handler for finalizing
  const handleFinalizeClick = () => {
    if (stats.pending > 0) {
      setShowFinalizeDialog(true);
    } else {
      onFinalize();
    }
  };

  // Add handler for confirming finalization
  const handleConfirmFinalize = () => {
    setShowFinalizeDialog(false);
    onFinalize();
  };

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
            bgcolor:
              stats.pending > 0
                ? palette.semantic.warning.background
                : undefined,
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
            backgroundColor: palette.neutral.white,
            boxShadow: 2,
            "&:hover": {
              backgroundColor: palette.neutral.white,
              boxShadow: 3,
            },
          }}
        >
          Volver
        </Button>
        <Button
          variant="contained"
          color="success"
          onClick={handleFinalizeClick}
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

      {/* Add the toggle button (after the Stats Cards and before the Table) */}
      <Box
        sx={{
          position: "fixed",
          right: 24,
          top: "50%",
          transform: "translateY(-50%)",
          zIndex: 10,
        }}
      >
        <Button
          variant="contained"
          onClick={() => setShowNormalReadings((prev) => !prev)}
          sx={{
            minWidth: "auto",
            borderRadius: "12px",
            py: 2,
            px: 2,
            backgroundColor: showNormalReadings
              ? palette.consumption.normal.main
              : palette.neutral.background,
            color: showNormalReadings
              ? palette.neutral.white
              : palette.neutral.text.primary,
            boxShadow: theme.shadows[3],
            transition: "all 0.2s ease-in-out",
            writingMode: "vertical-rl",
            textOrientation: "mixed",
            "&:hover": {
              backgroundColor: showNormalReadings
                ? palette.consumption.normal.dark
                : alpha(palette.neutral.background, 0.9),
              boxShadow: theme.shadows[6],
            },
          }}
        >
          {showNormalReadings ? "Ocultar Normales" : "Mostrar Normales"}
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
            {filteredRows.map((row) => {
              return (
                <TableRow
                  key={row.id}
                  sx={{
                    "&:last-child td, &:last-child th": { border: 0 },
                    // Add animation for smooth appearance
                    animation: "fadeIn 0.3s ease-in-out",
                    "@keyframes fadeIn": {
                      "0%": {
                        opacity: 0,
                        transform: "translateY(10px)",
                      },
                      "100%": {
                        opacity: 1,
                        transform: "translateY(0)",
                      },
                    },
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
                      color: palette.neutral.text.primary,
                      fontSize: "0.9rem",
                    }}
                  >
                    {row.previousReading}
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      fontWeight: 600,
                      color: palette.neutral.text.primary,
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
                              return palette.consumption.estimated.main;
                            case "negative":
                              return palette.consumption.negative.main;
                            case "low":
                              return palette.consumption.low.main;
                            case "high":
                              return palette.consumption.high.main;
                            case "none":
                              return palette.neutral.text.primary;
                            case "pending":
                              return palette.semantic.warning.main;
                            default:
                              return palette.consumption.normal.main;
                          }
                        },
                        fontSize: "0.9rem",
                        display: "inline-block",
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
                        <Chip
                          icon={<WarningIcon fontSize="small" />}
                          label="Pendiente"
                          sx={{
                            backgroundColor:
                              palette.semantic.warning.background,
                            color: palette.semantic.warning.main,
                            borderColor: palette.semantic.warning.border,
                            fontWeight: 600,
                          }}
                          size="small"
                        />
                      )}

                      {/* Show consumption status tag if applicable and confirmed */}
                      {row.isConfirmed &&
                        row.consumptionType.type !== "none" && (
                          <Chip
                            icon={(() => {
                              switch (row.consumptionType.type) {
                                case "estimated":
                                  return (
                                    <CalculateOutlinedIcon fontSize="small" />
                                  );
                                case "negative":
                                  return <TrendingDownIcon fontSize="small" />;
                                case "low":
                                  return <WaterDropIcon fontSize="small" />;
                                case "high":
                                  return <PriorityHighIcon fontSize="small" />;
                                default:
                                  return (
                                    <CheckCircleIcon
                                      fontSize="small"
                                      sx={{
                                        color: palette.consumption.normal.main,
                                      }}
                                    />
                                  );
                              }
                            })()}
                            label={row.consumptionType.label}
                            sx={(() => {
                              switch (row.consumptionType.type) {
                                case "estimated":
                                  return {
                                    backgroundColor:
                                      palette.consumption.estimated.background,
                                    color: palette.consumption.estimated.main,
                                    borderColor:
                                      palette.consumption.estimated.border,
                                    fontWeight: 600,
                                  };
                                case "negative":
                                  return {
                                    backgroundColor:
                                      palette.consumption.negative.background,
                                    color: palette.consumption.negative.main,
                                    borderColor:
                                      palette.consumption.negative.border,
                                    fontWeight: 600,
                                  };
                                case "low":
                                  return {
                                    backgroundColor:
                                      palette.consumption.low.background,
                                    color: palette.consumption.low.main,
                                    borderColor: palette.consumption.low.border,
                                    fontWeight: 600,
                                  };
                                case "high":
                                  return {
                                    backgroundColor:
                                      palette.consumption.high.background,
                                    color: palette.consumption.high.main,
                                    borderColor:
                                      palette.consumption.high.border,
                                    fontWeight: 600,
                                  };
                                default:
                                  return {
                                    backgroundColor:
                                      palette.consumption.normal.background,
                                    color: palette.consumption.normal.main,
                                    borderColor:
                                      palette.consumption.normal.border,
                                    fontWeight: 600,
                                  };
                              }
                            })()}
                            size="small"
                          />
                        )}
                    </Box>
                  </TableCell>
                  <TableCell align="center">
                    <Button
                      size="small"
                      onClick={() => {
                        // Find the original index in the meters array
                        const originalIndex = meters.findIndex(
                          (m) => m.ID === row.id
                        );
                        onSelectMeter(originalIndex);
                      }}
                      color="primary"
                      variant="outlined"
                      sx={{
                        minWidth: "80px",
                        backgroundColor: alpha(
                          palette.neutral.background,
                          0.05
                        ),
                        "&:hover": {
                          backgroundColor: alpha(
                            palette.neutral.background,
                            0.1
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

      {/* Add a count of hidden readings (after the table) */}
      {!showNormalReadings && rows.length !== filteredRows.length && (
        <Typography
          variant="body2"
          sx={{
            textAlign: "center",
            mt: 2,
            color: palette.neutral.text.secondary,
            fontStyle: "italic",
          }}
        >
          {rows.length - filteredRows.length} lecturas normales ocultas
        </Typography>
      )}

      {/* Add the finalize confirmation dialog */}
      <Dialog
        open={showFinalizeDialog}
        onClose={() => setShowFinalizeDialog(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            boxShadow: `0 8px 24px ${alpha(
              palette.neutral.text.primary,
              0.12
            )}`,
          },
        }}
      >
        <DialogTitle
          sx={{
            borderBottom: 1,
            borderColor: "divider",
            backgroundColor: alpha(palette.semantic.warning.light, 0.1),
            px: 3,
            py: 2.5,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <WarningIcon color="warning" />
            <Typography variant="h6">Lecturas Pendientes</Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <Alert severity="warning" sx={{ mb: 3 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
              Hay {stats.pending} lecturas pendientes de confirmar
            </Typography>
            <Typography variant="body2">
              ¿Está seguro que desea finalizar dejando estas lecturas sin
              confirmar?
            </Typography>
          </Alert>

          <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
            Lecturas pendientes:
          </Typography>

          <Paper
            elevation={0}
            sx={{
              maxHeight: 200,
              overflow: "auto",
              backgroundColor: alpha(palette.neutral.background, 0.5),
              border: `1px solid ${palette.neutral.border}`,
              borderRadius: 1,
            }}
          >
            <List dense>
              {rows
                .filter((row) => !row.isConfirmed)
                .map((row) => (
                  <ListItem
                    key={row.id}
                    sx={{
                      borderBottom: `1px solid ${alpha(
                        palette.neutral.border,
                        0.5
                      )}`,
                      "&:last-child": {
                        borderBottom: "none",
                      },
                    }}
                  >
                    <ListItemText
                      primary={`#${row.id}`}
                      secondary={row.address}
                      primaryTypographyProps={{
                        fontWeight: 600,
                      }}
                      secondaryTypographyProps={{
                        variant: "body2",
                      }}
                    />
                    <Chip
                      label="Pendiente"
                      size="small"
                      icon={<WarningIcon />}
                      sx={{
                        backgroundColor: palette.semantic.warning.background,
                        color: palette.semantic.warning.main,
                        fontWeight: 600,
                      }}
                    />
                  </ListItem>
                ))}
            </List>
          </Paper>
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
            onClick={() => setShowFinalizeDialog(false)}
            variant="outlined"
            color="inherit"
            sx={{ minWidth: 100 }}
          >
            Volver y Editar
          </Button>
          <Button
            onClick={handleConfirmFinalize}
            variant="contained"
            color="warning"
            startIcon={<WarningIcon />}
            sx={{ minWidth: 140 }}
          >
            Sí, Finalizar
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default SummaryScreen;

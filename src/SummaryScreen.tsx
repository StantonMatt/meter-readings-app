import React, { useState, useMemo } from "react";
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
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
  const [showConfirmDialog, setShowConfirmDialog] = useState<boolean>(false);
  const [showSendDialog, setShowSendDialog] = useState<boolean>(false);

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
    return meters.map((meter) => {
      const reading = readingsState[meter.ID];
      const readingValue = reading?.reading || "---";
      const isConfirmed = reading?.isConfirmed || false;

      // Get the last reading from meter.readings
      const previousReadings = Object.entries(meter.readings || {})
        .filter(([key]) => key !== "ID" && key !== "ADDRESS")
        .sort((a, b) => b[0].localeCompare(a[0])); // Sort by date desc

      const previousReading =
        previousReadings.length > 0 ? previousReadings[0][1] : "---";

      // Calculate consumption
      let consumption = "---";
      if (
        readingValue !== "---" &&
        previousReading !== "---" &&
        previousReading !== "NO DATA"
      ) {
        try {
          const current = parseFloat(readingValue);
          const previous = parseFloat(String(previousReading || "0"));
          consumption = (current - previous).toString();
        } catch (e) {
          console.error("Error calculating consumption:", e);
        }
      }

      return {
        id: meter.ID,
        address: meter.ADDRESS,
        previousReading,
        currentReading: readingValue,
        consumption,
        status: reading?.reading
          ? isConfirmed
            ? "confirmed"
            : "pending"
          : "skipped",
      };
    });
  }, [meters, readingsState]);

  // Reset a reading if needed
  const handleResetReading = (meterId: string | number): void => {
    if (setReadingsState) {
      setReadingsState((prev) => {
        const next = { ...prev };
        delete next[String(meterId)];
        return next;
      });

      // Also remove from localStorage
      localStorage.removeItem(`meter_${meterId}_reading`);
      localStorage.removeItem(`meter_${meterId}_confirmed`);
      localStorage.removeItem(`meter_${meterId}_verification`);
    }
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
          onClick={() => setShowConfirmDialog(true)}
          disabled={stats.confirmed === 0}
        >
          Finalizar y Enviar
        </Button>
      </Box>

      {/* Confirm dialog */}
      <Dialog
        open={showConfirmDialog}
        onClose={() => setShowConfirmDialog(false)}
      >
        <DialogTitle>Confirmar envío de lecturas</DialogTitle>
        <DialogContent>
          <Typography paragraph>
            ¿Está seguro que desea finalizar y enviar las lecturas? Se enviará
            un correo electrónico con el resumen de las lecturas.
          </Typography>
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Resumen de lecturas:
            </Typography>
            <List dense>
              <ListItem>
                <ListItemText
                  primary={`${stats.confirmed} lecturas confirmadas`}
                />
              </ListItem>
              <Divider />
              <ListItem>
                <ListItemText
                  primary={`${stats.pending} lecturas pendientes`}
                  secondary={
                    stats.pending > 0
                      ? "Estas lecturas no se enviarán"
                      : undefined
                  }
                />
              </ListItem>
              <Divider />
              <ListItem>
                <ListItemText primary={`${stats.skipped} lecturas omitidas`} />
              </ListItem>
            </List>
          </Box>
          <Typography variant="body2" color="text.secondary">
            Esta acción no se puede deshacer. ¿Desea continuar?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowConfirmDialog(false)}>Cancelar</Button>
          <Button
            onClick={() => {
              setShowConfirmDialog(false);
              setShowSendDialog(true);
              onFinalize();
            }}
            variant="contained"
            color="primary"
            autoFocus
          >
            Confirmar y Enviar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Sending dialog */}
      <Dialog open={showSendDialog}>
        <DialogTitle>Enviando lecturas</DialogTitle>
        <DialogContent>
          <Typography>
            Enviando lecturas al servidor. Por favor espere...
          </Typography>
        </DialogContent>
      </Dialog>
    </Container>
  );
}

export default SummaryScreen;

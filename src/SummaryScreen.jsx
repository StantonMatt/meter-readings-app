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

function SummaryScreen({
  meters,
  readingsState,
  setReadingsState,
  onFinalize,
  onBack,
  onSelectMeter,
  selectedMonth,
  selectedYear,
}) {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showSendDialog, setShowSendDialog] = useState(false);

  // Calculate reading statistics
  const stats = useMemo(() => {
    const confirmed = meters.filter(
      (meter) => readingsState[meter.ID]?.isConfirmed
    ).length;

    const pending = meters.filter(
      (meter) =>
        readingsState[meter.ID]?.reading &&
        !readingsState[meter.ID]?.isConfirmed
    ).length;

    const omitted = meters.filter(
      (meter) => !readingsState[meter.ID]?.reading
    ).length;

    return { confirmed, pending, omitted };
  }, [meters, readingsState]);

  const completedReadings = meters.filter(
    (meter) => readingsState[meter.ID]?.isConfirmed
  );

  const missingOrPendingReadings = meters.filter((meter) => {
    const reading = readingsState[meter.ID];
    return reading?.reading && !reading.isConfirmed;
  });

  // Handler for row clicks
  const handleRowClick = (meterIndex) => {
    onSelectMeter(meterIndex);
  };

  const handleFinalize = () => {
    setShowSendDialog(true);
  };

  const handleConfirmAll = () => {
    // Confirm all pending readings
    const newReadingsState = { ...readingsState };
    meters.forEach((meter) => {
      const state = readingsState[meter.ID];
      if (state?.reading && !state?.isConfirmed) {
        newReadingsState[meter.ID] = {
          ...state,
          isConfirmed: true,
        };
        // Update localStorage
        localStorage.setItem(`meter_${meter.ID}_confirmed`, "true");
      }
    });

    // Update state and send readings
    setReadingsState(newReadingsState);
    setShowConfirmDialog(false);
    onFinalize();
  };

  const handleSendWithoutConfirming = () => {
    setShowConfirmDialog(false);
    onFinalize();
  };

  const handleConfirmSend = () => {
    setShowSendDialog(false);
    onFinalize();
  };

  return (
    <Container maxWidth="lg">
      <Box
        sx={{
          mt: 2,
          mb: 4,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Button variant="outlined" onClick={onBack} sx={{ mb: 2 }}>
          Volver a Editar Lecturas
        </Button>

        <Button
          variant="contained"
          color="success"
          size="large"
          onClick={handleFinalize}
        >
          Enviar Lecturas
        </Button>
      </Box>

      {/* Update the confirmation dialog */}
      <Dialog
        open={showConfirmDialog}
        onClose={() => setShowConfirmDialog(false)}
        aria-labelledby="confirm-dialog-title"
        disablePortal={false}
        keepMounted={false}
      >
        <DialogTitle id="confirm-dialog-title">Lecturas Pendientes</DialogTitle>
        <DialogContent>
          <Typography>
            Hay lecturas ingresadas que aún no han sido confirmadas. ¿Qué desea
            hacer?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ flexDirection: "column", gap: 1, p: 2 }}>
          <Button
            fullWidth
            variant="contained"
            color="success"
            onClick={handleConfirmAll}
          >
            Confirmar Todas y Enviar
          </Button>
          <Button
            fullWidth
            variant="contained"
            color="warning"
            onClick={handleSendWithoutConfirming}
          >
            Enviar Sin Confirmar
          </Button>
          <Button fullWidth onClick={() => setShowConfirmDialog(false)}>
            Cancelar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Update the send confirmation dialog */}
      <Dialog
        open={showSendDialog}
        onClose={() => setShowSendDialog(false)}
        maxWidth="sm"
        fullWidth
        aria-labelledby="send-dialog-title"
        disablePortal={false}
        keepMounted={false}
      >
        <DialogTitle id="send-dialog-title">
          Confirmar Envío de Lecturas
        </DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            {missingOrPendingReadings.length === 0
              ? "¿Está seguro que desea enviar todas las lecturas?"
              : "Hay lecturas pendientes o faltantes:"}
          </Typography>

          {missingOrPendingReadings.length > 0 && (
            <>
              <Typography
                variant="subtitle2"
                color="warning.main"
                sx={{ mt: 2 }}
              >
                Lecturas Sin Confirmar ({missingOrPendingReadings.length}):
              </Typography>
              <List dense>
                {missingOrPendingReadings.map((meter) => (
                  <ListItem key={meter.ID}>
                    <ListItemText
                      primary={`Cliente ${meter.ID}`}
                      secondary={meter.ADDRESS}
                    />
                  </ListItem>
                ))}
              </List>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSendDialog(false)} tabIndex={0}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleConfirmSend}
            color={missingOrPendingReadings.length > 0 ? "warning" : "primary"}
            tabIndex={0}
          >
            {missingOrPendingReadings.length > 0
              ? "Enviar de Todas Formas"
              : "Confirmar Envío"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* New Stats Table */}
      <Box
        sx={{
          display: "flex",
          gap: 2,
          mb: 4,
          justifyContent: "center",
        }}
      >
        <Paper
          elevation={0}
          sx={{
            p: 2,
            display: "flex",
            gap: 3,
            backgroundColor: "rgba(0, 0, 0, 0.02)",
            borderRadius: 2,
          }}
        >
          <Box
            sx={{
              textAlign: "center",
              px: 3,
              borderRight: "1px solid rgba(0, 0, 0, 0.12)",
            }}
          >
            <Typography
              variant="h5"
              sx={{ color: "success.main", fontWeight: "bold" }}
            >
              {stats.confirmed}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Confirmadas
            </Typography>
          </Box>

          <Box
            sx={{
              textAlign: "center",
              px: 3,
              borderRight: "1px solid rgba(0, 0, 0, 0.12)",
            }}
          >
            <Typography
              variant="h5"
              sx={{ color: "warning.main", fontWeight: "bold" }}
            >
              {stats.pending}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Pendientes
            </Typography>
          </Box>

          <Box sx={{ textAlign: "center", px: 3 }}>
            <Typography
              variant="h5"
              sx={{ color: "error.main", fontWeight: "bold" }}
            >
              {stats.omitted}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Omitidas
            </Typography>
          </Box>
        </Paper>
      </Box>

      {stats.pending + stats.omitted > 0 && (
        <Alert
          severity="warning"
          sx={{
            mt: 2,
            mb: 2,
            "& .MuiAlert-message": {
              color: "#663c00",
              fontWeight: "medium",
            },
          }}
        >
          Advertencia: Hay lecturas faltantes o sin confirmar
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>CLIENTE</TableCell>
              <TableCell>Direccion</TableCell>
              <TableCell>Lectura Anterior</TableCell>
              <TableCell align="right">Lectura Actual</TableCell>
              <TableCell>Estado</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {meters.map((meter, index) => {
              const reading = readingsState[meter.ID];
              const isConfirmed = reading?.isConfirmed;
              const hasReading = reading?.reading;

              // Get last month's reading
              const previousReadings = Object.entries(meter.readings)
                .filter(([k]) => k !== "ID")
                .sort((a, b) => b[0].localeCompare(a[0]));
              const lastMonthReading = previousReadings[0]?.[1] || "---";

              let status;
              if (!hasReading) {
                status = <Chip label="Omitido" color="error" size="small" />;
              } else if (!isConfirmed) {
                status = (
                  <Chip label="Sin Confirmar" color="warning" size="small" />
                );
              } else {
                status = (
                  <Chip label="Confirmado" color="success" size="small" />
                );
              }

              return (
                <TableRow
                  key={meter.ID}
                  onClick={() => handleRowClick(index)}
                  sx={{
                    cursor: "pointer",
                    "&:hover": {
                      backgroundColor: "rgba(0, 0, 0, 0.04)",
                    },
                  }}
                >
                  <TableCell>{meter.ID}</TableCell>
                  <TableCell>{meter.ADDRESS}</TableCell>
                  <TableCell>{lastMonthReading}</TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      fontWeight: "medium",
                      color:
                        hasReading &&
                        lastMonthReading !== "---" &&
                        Number(reading.reading) < Number(lastMonthReading)
                          ? "error.main"
                          : "inherit",
                    }}
                  >
                    {hasReading ? reading.reading : "---"}
                  </TableCell>
                  <TableCell>{status}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <Typography variant="body2" sx={{ mt: 2, color: "text.secondary" }}>
        Haga clic en cualquier fila para editar la lectura
      </Typography>
    </Container>
  );
}

export default SummaryScreen;

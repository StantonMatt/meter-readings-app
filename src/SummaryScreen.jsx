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
  onFinalize,
  onBack,
  onSelectMeter,
}) {
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

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
    setConfirmDialogOpen(true);
  };

  const handleConfirmFinalize = () => {
    setConfirmDialogOpen(false);
    onFinalize();
  };

  return (
    <Container maxWidth="lg">
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
          ⚠️ Advertencia: Hay lecturas faltantes o sin confirmar
        </Alert>
      )}

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

      {/* Confirmation Dialog */}
      <Dialog
        open={confirmDialogOpen}
        onClose={() => setConfirmDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>¿Está seguro que desea enviar las lecturas?</DialogTitle>
        <DialogContent>
          {missingOrPendingReadings.length > 0 ? (
            <>
              <Typography color="error" gutterBottom>
                Las siguientes lecturas están pendientes o sin confirmar:
              </Typography>
              <List>
                {missingOrPendingReadings.map((meter) => (
                  <React.Fragment key={meter.ID}>
                    <ListItem>
                      <ListItemText
                        primary={`Cliente: ${meter.ID}`}
                        secondary={
                          <>
                            {meter.ADDRESS}
                            <br />
                            Estado:{" "}
                            {readingsState[meter.ID]?.reading
                              ? "Sin Confirmar"
                              : "Sin Lectura"}
                          </>
                        }
                      />
                    </ListItem>
                    <Divider />
                  </React.Fragment>
                ))}
              </List>
            </>
          ) : (
            <Typography>
              Todas las lecturas están completas y confirmadas.
            </Typography>
          )}
          <Typography sx={{ mt: 2 }}>
            {missingOrPendingReadings.length > 0
              ? "¿Desea continuar de todos modos?"
              : "¿Desea proceder con el envío?"}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialogOpen(false)}>Cancelar</Button>
          <Button
            onClick={handleConfirmFinalize}
            variant="contained"
            color="success"
          >
            Confirmar Envío
          </Button>
        </DialogActions>
      </Dialog>

      <Typography variant="h4" gutterBottom>
        Resumen de Todos los Medidores
      </Typography>

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

import React, { useState } from "react";
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

  const completedReadings = meters.filter(
    (meter) => readingsState[meter.ID]?.isConfirmed
  );

  const missingOrPendingReadings = meters.filter(
    (meter) => !readingsState[meter.ID]?.isConfirmed
  );

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
      {completedReadings.length < meters.length && (
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

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Lecturas Confirmadas: {completedReadings.length} de {meters.length}
      </Typography>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>CLIENTE</TableCell>
              <TableCell>Dirección</TableCell>
              <TableCell>Mes Anterior</TableCell>
              <TableCell align="right">Lectura Actual</TableCell>
              <TableCell>Estado</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {meters.map((meter, index) => {
              const reading = readingsState[meter.ID];
              const isConfirmed = reading?.isConfirmed;

              // Get last month's reading
              const previousReadings = Object.entries(meter.readings)
                .filter(([k]) => k !== "ID")
                .sort((a, b) => b[0].localeCompare(a[0]));
              const lastMonthReading = previousReadings[0]?.[1] || "---";

              let status;
              if (!reading) {
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
                        reading &&
                        lastMonthReading !== "---" &&
                        Number(reading.reading) < Number(lastMonthReading)
                          ? "error.main"
                          : "inherit",
                    }}
                  >
                    {reading?.reading || "---"}
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

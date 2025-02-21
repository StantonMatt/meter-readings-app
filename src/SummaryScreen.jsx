import React from "react";
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
} from "@mui/material";

function SummaryScreen({ combinedMeters, submittedReadings, onSelectMeter }) {
  // Create a map of submitted readings for easy lookup
  const submittedMap = {};
  submittedReadings.forEach((reading) => {
    submittedMap[reading.ID] = reading.reading;
  });

  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 4 }}>
        <Typography variant="h4" gutterBottom>
          Resumen de Todos los Medidores
        </Typography>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Lecturas Confirmadas: {submittedReadings.length} de{" "}
          {combinedMeters.length}
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
              {combinedMeters.map((meter, index) => {
                const reading = localStorage.getItem(
                  `meter_${meter.ID}_reading`
                );
                const isConfirmed =
                  localStorage.getItem(`meter_${meter.ID}_confirmed`) ===
                  "true";

                // Get last month's reading
                const previousReadings = Object.entries(meter.readings)
                  .filter(([k]) => k !== "ID")
                  .sort((a, b) => b[0].localeCompare(a[0])); // Sort in reverse chronological order
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
                    onClick={() => onSelectMeter(index)}
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
                          Number(reading) < Number(lastMonthReading)
                            ? "error.main"
                            : "inherit",
                      }}
                    >
                      {reading || "---"}
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

        {submittedReadings.length < combinedMeters.length && (
          <Typography variant="body2" color="error" sx={{ mt: 2 }}>
            Advertencia: Algunos medidores fueron omitidos o tienen lecturas sin
            confirmar. Solo se enviarán las lecturas confirmadas.
          </Typography>
        )}
      </Box>
    </Container>
  );
}

export default SummaryScreen;

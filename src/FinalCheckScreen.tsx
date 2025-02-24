import React, { useState } from "react";
import {
  Box,
  Button,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { signOut } from "firebase/auth";
import { auth } from "./firebase-config";
import { MeterData, ReadingsState } from "./utils/readingUtils";

interface FinalCheckScreenProps {
  readingsState: ReadingsState;
  meters: MeterData[];
  onContinue: () => void;
  onViewSummary: () => void;
  onFinish: () => void;
}

function FinalCheckScreen({
  readingsState,
  meters,
  onContinue,
  onViewSummary,
  onFinish,
}: FinalCheckScreenProps): JSX.Element {
  const [showConfirmDialog, setShowConfirmDialog] = useState<boolean>(false);

  // Calculate statistics
  const confirmedReadings = meters.filter(
    (meter) => readingsState[meter.ID]?.isConfirmed
  ).length;

  const totalMeters = meters.length;
  const completionPercentage = Math.round((confirmedReadings / totalMeters) * 100);

  // Handle signing out
  const handleSignOut = async (): Promise<void> => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  // Check if there are pending readings
  const hasPendingReadings = (): boolean => {
    return meters.some(
      (meter) =>
        readingsState[meter.ID]?.reading && !readingsState[meter.ID]?.isConfirmed
    );
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "calc(100vh - 64px)",
        padding: 3,
      }}
    >
      <Paper
        elevation={3}
        sx={{
          p: 4,
          maxWidth: 600,
          width: "100%",
          textAlign: "center",
        }}
      >
        <CheckCircleIcon
          color="success"
          sx={{ fontSize: 80, mb: 2 }}
        />

        <Typography variant="h4" gutterBottom>
          ¡Lecturas Enviadas!
        </Typography>

        <Typography variant="body1" paragraph>
          Las lecturas han sido enviadas correctamente al servidor.
        </Typography>

        <TableContainer component={Paper} elevation={0} sx={{ mb: 3 }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Estadísticas</TableCell>
                <TableCell align="right">Valor</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell>Medidores Totales</TableCell>
                <TableCell align="right">{totalMeters}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Lecturas Confirmadas</TableCell>
                <TableCell align="right">{confirmedReadings}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Porcentaje Completado</TableCell>
                <TableCell align="right">{completionPercentage}%</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>

        <Box sx={{ mt: 3, display: "flex", flexDirection: "column", gap: 2 }}>
          {hasPendingReadings() && (
            <Button
              variant="outlined"
              onClick={onContinue}
              fullWidth
            >
              Continuar con Lecturas Pendientes
            </Button>
          )}
          <Button
            variant="outlined"
            onClick={onViewSummary}
            fullWidth
          >
            Ver Resumen de Lecturas
          </Button>
          <Button
            variant="contained"
            onClick={() => setShowConfirmDialog(true)}
            fullWidth
          >
            Finalizar Sesión de Lecturas
          </Button>
        </Box>
      </Paper>

      {/* Confirm dialog */}
      <Dialog
        open={showConfirmDialog}
        onClose={() => setShowConfirmDialog(false)}
      >
        <DialogTitle>Finalizar Sesión de Lecturas</DialogTitle>
        <DialogContent>
          <Typography>
            ¿Está seguro que desea finalizar la sesión de lecturas? Esto lo
            llevará de vuelta a la pantalla de inicio.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowConfirmDialog(false)}>Cancelar</Button>
          <Button
            onClick={() => {
              setShowConfirmDialog(false);
              onFinish();
            }}
            variant="contained"
          >
            Finalizar Sesión
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default FinalCheckScreen;
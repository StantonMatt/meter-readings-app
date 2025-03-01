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
  DialogContentText,
  DialogActions,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import LogoutIcon from "@mui/icons-material/Logout";
import { signOut } from "firebase/auth";
import { auth } from "./firebase-config";
import { MeterData, ReadingsState } from "./utils/readingUtils";
import { useState } from "react";

interface FinalCheckScreenProps {
  readingsState: ReadingsState;
  meters: MeterData[];
  onBack: () => void;
  onGoToSummary: () => void;
  onSelectMeter: (index: number) => void;
  onContinue: () => void;
  onViewSummary: () => void;
  onFinish: () => void;
  onClearData: () => void;
}

function FinalCheckScreen({
  readingsState,
  meters,
  onBack,
  onGoToSummary,
  onSelectMeter,
  onContinue,
  onViewSummary,
  onFinish,
  onClearData,
}: FinalCheckScreenProps): JSX.Element {
  // Add state for logout dialog
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState<boolean>(false);

  // Calculate statistics
  const confirmedReadings = meters.filter(
    (meter) => readingsState[meter.ID]?.isConfirmed
  ).length;

  const totalMeters = meters.length;
  const completionPercentage = Math.round(
    (confirmedReadings / totalMeters) * 100
  );

  // Handle signing out and clearing session data
  const handleSignOutAndClear = async (): Promise<void> => {
    try {
      // Clear all reading-related data from localStorage
      const keys = Object.keys(localStorage);
      keys.forEach((key) => {
        // Only clear keys related to meter readings and app state
        if (key.startsWith("meter_") || key.startsWith("appState_")) {
          localStorage.removeItem(key);
        }
      });

      // Also clear the lastViewedMeterIndex from localStorage
      localStorage.removeItem("lastViewedMeterIndex");

      // Clear data in parent component
      onClearData();

      // Finally, sign out the user
      await signOut(auth);
    } catch (error) {
      console.error("Error during sign out:", error);
    }
  };

  // Check if there are pending readings
  const hasPendingReadings = (): boolean => {
    return meters.some(
      (meter) =>
        readingsState[meter.ID]?.reading &&
        !readingsState[meter.ID]?.isConfirmed
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
        <CheckCircleIcon color="success" sx={{ fontSize: 80, mb: 2 }} />

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
            <Button variant="outlined" onClick={onContinue} fullWidth>
              Continuar con Lecturas Pendientes
            </Button>
          )}
          <Button variant="outlined" onClick={onViewSummary} fullWidth>
            Ver Resumen de Lecturas
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={() => setIsLogoutDialogOpen(true)}
            startIcon={<LogoutIcon />}
            fullWidth
          >
            Finalizar Sesión de Lecturas
          </Button>
        </Box>
      </Paper>

      {/* Logout Confirmation Dialog */}
      <Dialog
        open={isLogoutDialogOpen}
        onClose={() => setIsLogoutDialogOpen(false)}
        aria-labelledby="logout-dialog-title"
        aria-describedby="logout-dialog-description"
      >
        <DialogTitle id="logout-dialog-title">
          ¿Finalizar Sesión de Lecturas?
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="logout-dialog-description">
            Esta acción cerrará su sesión y eliminará todos los datos temporales
            de lecturas. ¿Está seguro que desea continuar?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsLogoutDialogOpen(false)} color="primary">
            Cancelar
          </Button>
          <Button
            onClick={handleSignOutAndClear}
            color="error"
            variant="contained"
            startIcon={<LogoutIcon />}
          >
            Finalizar Sesión
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default FinalCheckScreen;

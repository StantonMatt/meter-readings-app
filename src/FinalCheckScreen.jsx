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

function FinalCheckScreen({
  readingsState,
  meters,
  onContinue,
  onViewSummary,
  onFinish,
}) {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Calculate statistics
  const stats = meters.reduce(
    (acc, meter) => {
      const state = readingsState[meter.ID];
      if (state?.isConfirmed) {
        acc.confirmed++;
      } else if (state?.reading) {
        acc.pending++;
      } else {
        acc.skipped++;
      }
      return acc;
    },
    { confirmed: 0, pending: 0, skipped: 0 }
  );

  const handleFinishClick = () => {
    setShowConfirmDialog(true);
  };

  const handleConfirmFinish = async () => {
    setShowConfirmDialog(false);
    try {
      await signOut(auth);
      onFinish();
    } catch (error) {
      console.error("Error signing out:", error);
      onFinish();
    }
  };

  return (
    <>
      <Paper
        sx={{
          maxWidth: 600,
          mx: "auto",
          p: 4,
          backgroundColor: "#ffffff",
          borderRadius: 2,
          boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
        }}
      >
        <Box sx={{ textAlign: "center", mb: 4 }}>
          <CheckCircleIcon
            sx={{
              fontSize: 64,
              color: "#10B981",
              mb: 2,
            }}
          />
          <Typography variant="h5" gutterBottom sx={{ color: "#111827" }}>
            Lecturas enviadas exitosamente
          </Typography>
        </Box>

        <TableContainer sx={{ mb: 4 }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Estado</TableCell>
                <TableCell align="right">Cantidad</TableCell>
                <TableCell align="right">Porcentaje</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell>Confirmadas</TableCell>
                <TableCell align="right">{stats.confirmed}</TableCell>
                <TableCell align="right">
                  {Math.round((stats.confirmed / meters.length) * 100)}%
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Pendientes</TableCell>
                <TableCell align="right">{stats.pending}</TableCell>
                <TableCell align="right">
                  {Math.round((stats.pending / meters.length) * 100)}%
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Omitidas</TableCell>
                <TableCell align="right">{stats.skipped}</TableCell>
                <TableCell align="right">
                  {Math.round((stats.skipped / meters.length) * 100)}%
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>

        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
            "& .MuiButton-root": {
              py: 1.5,
            },
          }}
        >
          <Button
            variant="outlined"
            onClick={onContinue}
            sx={{
              color: "#4B5563",
              borderColor: "#4B5563",
              "&:hover": {
                borderColor: "#374151",
                backgroundColor: "rgba(75, 85, 99, 0.04)",
              },
            }}
          >
            Continuar Editando
          </Button>

          <Button
            variant="contained"
            onClick={onViewSummary}
            sx={{
              backgroundColor: "#1E40AF",
              "&:hover": {
                backgroundColor: "#1E3A8A",
              },
            }}
          >
            Ver Resumen Detallado
          </Button>

          <Button
            variant="contained"
            onClick={handleFinishClick}
            sx={{
              backgroundColor: "#059669",
              "&:hover": {
                backgroundColor: "#047857",
              },
            }}
          >
            Finalizar y Reiniciar
          </Button>
        </Box>
      </Paper>

      {/* Confirmation Dialog */}
      <Dialog
        open={showConfirmDialog}
        onClose={() => setShowConfirmDialog(false)}
      >
        <DialogTitle>¿Está seguro?</DialogTitle>
        <DialogContent>
          <Typography>
            Las lecturas ya han sido enviadas exitosamente, pero al finalizar se
            borrarán todos los datos ingresados de la aplicación. ¿Desea
            continuar?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setShowConfirmDialog(false)}
            sx={{
              color: "#4B5563",
            }}
          >
            No, Cancelar
          </Button>
          <Button
            onClick={handleConfirmFinish}
            variant="contained"
            sx={{
              backgroundColor: "#059669",
              "&:hover": {
                backgroundColor: "#047857",
              },
            }}
          >
            Sí, Finalizar
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default FinalCheckScreen;

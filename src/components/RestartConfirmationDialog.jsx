import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
} from "@mui/material";

/**
 * Dialog to confirm restarting the readings process
 * @param {Object} props - Component props
 * @param {boolean} props.open - Whether dialog is open
 * @param {Function} props.onClose - Function to close dialog
 * @param {string} props.confirmationText - Current confirmation text
 * @param {Function} props.onConfirmationChange - Handler for text changes
 * @param {Function} props.onConfirm - Function to confirm restart
 * @returns {JSX.Element} Confirmation dialog component
 */
function RestartConfirmationDialog({
  open,
  onClose,
  confirmationText,
  onConfirmationChange,
  onConfirm,
}) {
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>¿Está seguro que desea reiniciar?</DialogTitle>
      <DialogContent>
        <Typography gutterBottom>
          Esta acción eliminará todas las lecturas ingresadas.
        </Typography>
        <Typography gutterBottom>
          Escriba "REINICIAR" para confirmar:
        </Typography>
        <TextField
          fullWidth
          value={confirmationText}
          onChange={(e) => onConfirmationChange(e.target.value)}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          color="error"
          disabled={confirmationText !== "REINICIAR"}
          onClick={onConfirm}
        >
          Confirmar Reinicio
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default RestartConfirmationDialog;
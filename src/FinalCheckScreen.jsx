import React from "react";
import { Container, Box, Typography, Button } from "@mui/material";

function FinalCheckScreen({ allComplete, onGoBack, onFinish }) {
  return (
    <Container maxWidth="sm">
      <Box textAlign="center" sx={{ mt: 4 }}>
        <Typography variant="h4" gutterBottom>
          Verificación Final
        </Typography>
        {allComplete ? (
          <Typography variant="body1" gutterBottom>
            Ha ingresado lecturas para todos los medidores.
          </Typography>
        ) : (
          <Typography variant="body1" gutterBottom>
            NO ha ingresado lecturas para todos los medidores. Puede continuar,
            pero algunos pueden faltar.
          </Typography>
        )}
        <Box sx={{ mt: 2 }}>
          <Button variant="outlined" onClick={onGoBack} sx={{ mr: 2 }}>
            Regresar
          </Button>
          <Button variant="contained" color="primary" onClick={onFinish}>
            Finalizar
          </Button>
        </Box>
      </Box>
    </Container>
  );
}

export default FinalCheckScreen;

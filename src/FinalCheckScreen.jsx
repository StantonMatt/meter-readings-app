import React from "react";
import { Container, Box, Typography, Button } from "@mui/material";

function FinalCheckScreen({ allComplete, onGoBack, onFinish }) {
  return (
    <Container maxWidth="sm">
      <Box textAlign="center" sx={{ py: 4 }}>
        <Typography variant="h5" gutterBottom>
          ¿Ha terminado de ingresar todas las lecturas?
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
        <Box sx={{ mt: 4 }}>
          <Button variant="outlined" onClick={onGoBack} sx={{ mr: 2 }}>
            Volver
          </Button>
          <Button variant="contained" color="primary" onClick={onFinish}>
            Revisar Lecturas
          </Button>
        </Box>
      </Box>
    </Container>
  );
}

export default FinalCheckScreen;

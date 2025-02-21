// HomeScreen.jsx
import React from "react";
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Button,
} from "@mui/material";

function HomeScreen({
  hasReadings,
  onStart,
  onContinue,
  onRestart,
  routes,
  onRouteSelect,
}) {
  return (
    <Container maxWidth="lg">
      <Box sx={{ display: "flex", gap: 2, mb: 3, flexWrap: "wrap" }}>
        <Card sx={{ flex: "1 1 200px" }}>
          <CardContent>
            <Typography variant="overline" color="textSecondary">
              Mes Actual
            </Typography>
            <Typography variant="h5">Febrero</Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: "1 1 200px" }}>
          <CardContent>
            <Typography variant="overline" color="textSecondary">
              Ruta
            </Typography>
            <Typography variant="h5">ruta1</Typography>
          </CardContent>
        </Card>
      </Box>

      <Card>
        <CardContent>
          <Typography variant="h4" gutterBottom>
            Seleccionar Ruta
          </Typography>
          <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
            {routes.map((route) => (
              <Button
                key={route.name}
                variant="outlined"
                onClick={() => onRouteSelect(route)}
              >
                {route.name} ({route.lastUpdated})
              </Button>
            ))}
          </Box>
          <Typography variant="h4" gutterBottom>
            COAB Lectura de Medidores
          </Typography>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Bienvenido al sistema de lectura de medidores.
          </Typography>
          <Box sx={{ display: "flex", gap: 2, justifyContent: "center" }}>
            {hasReadings ? (
              <>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={onContinue}
                >
                  CONTINUAR
                </Button>
                <Button variant="outlined" color="error" onClick={onRestart}>
                  REINICIAR
                </Button>
              </>
            ) : (
              <Button variant="contained" color="primary" onClick={onStart}>
                COMENZAR
              </Button>
            )}
          </Box>
        </CardContent>
      </Card>
    </Container>
  );
}

export default HomeScreen;

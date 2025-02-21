// HomeScreen.jsx
import React from "react";
import { Container, Typography, Box, Card, CardContent } from "@mui/material";

function HomeScreen({ hasReadings, onStart, onContinue, onRestart }) {
  return (
    <Container maxWidth="lg">
      <Box sx={{ display: "flex", gap: 2, mb: 3, flexWrap: "wrap" }}>
        <Card sx={{ flex: "1 1 200px" }}>
          <CardContent>
            <Typography variant="overline" color="textSecondary">
              Current Month
            </Typography>
            <Typography variant="h5">February</Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: "1 1 200px" }}>
          <CardContent>
            <Typography variant="overline" color="textSecondary">
              Route
            </Typography>
            <Typography variant="h5">route1</Typography>
          </CardContent>
        </Card>
      </Box>

      <Card>
        <CardContent>
          <Typography variant="h4" gutterBottom>
            COAB Water Meter App
          </Typography>
          <Typography variant="body1" sx={{ mb: 2 }}>
            This is your home screen.
          </Typography>
          <Box>
            {hasReadings ? (
              <>
                <button onClick={onContinue}>CONTINUE</button>
                <button onClick={onRestart}>RESTART</button>
              </>
            ) : (
              <button onClick={onStart}>START</button>
            )}
          </Box>
        </CardContent>
      </Card>
    </Container>
  );
}

export default HomeScreen;

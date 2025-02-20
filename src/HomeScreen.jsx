import React from 'react';
import { Container, Typography, Button, Box } from '@mui/material';

function HomeScreen({ onStart, onRestart }) {
  return (
    <Container maxWidth="sm">
      <Box textAlign="center" sx={{ mt: 4 }}>
        <Typography variant="h3" component="h1" gutterBottom>
          COAB Water Meter App
        </Typography>
        <Typography variant="body1">Current Month: February</Typography>
        <Typography variant="body1">Route: route1</Typography>
        <Box sx={{ mt: 2 }}>
          <Button variant="contained" color="primary" onClick={onStart} sx={{ mr: 2 }}>
            START
          </Button>
          <Button variant="outlined" color="secondary" onClick={onRestart}>
            RESTART
          </Button>
        </Box>
      </Box>
    </Container>
  );
}

export default HomeScreen;

import React from 'react';
import { Container, Box, Typography, Button } from '@mui/material';

function FinalCheckScreen({ allComplete, onGoBack, onFinish }) {
  return (
    <Container maxWidth="sm">
      <Box textAlign="center" sx={{ mt: 4 }}>
        <Typography variant="h4" gutterBottom>
          Final Check
        </Typography>
        {allComplete ? (
          <Typography variant="body1" gutterBottom>
            You have entered readings for all meters.
          </Typography>
        ) : (
          <Typography variant="body1" gutterBottom>
            You have NOT entered readings for all meters. You can still proceed, but some may be missing.
          </Typography>
        )}
        <Box sx={{ mt: 2 }}>
          <Button variant="outlined" onClick={onGoBack} sx={{ mr: 2 }}>
            Go Back
          </Button>
          <Button variant="contained" color="primary" onClick={onFinish}>
            Finish
          </Button>
        </Box>
      </Box>
    </Container>
  );
}

export default FinalCheckScreen;

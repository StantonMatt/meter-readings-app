// src/MeterScreen.jsx
import React from 'react';
import { Paper, Typography, Box, Button, TextField, Grid } from '@mui/material';

function MeterScreen({
  meter,
  currentIndex,
  totalMeters,
  pendingReading,
  onReadingChange,
  onSubmit,
  onPrev,
}) {
  const previousReadings = Object.entries(meter.readings)
    .filter(([k]) => k !== 'ID')
    .sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <Paper sx={{ p: 3, mb: 2 }}>
      <Typography variant="h5" gutterBottom>
        Meter {meter.ID}
      </Typography>
      <Typography variant="subtitle1" gutterBottom>
        Address: {meter.ADDRESS}
      </Typography>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6">Previous Readings</Typography>
        {previousReadings.map(([dateKey, val]) => (
          <Typography key={dateKey} variant="body2">
            {dateKey}: {val}
          </Typography>
        ))}
      </Box>
      <TextField
        label="Enter Current Reading"
        type="number"
        value={pendingReading}
        onChange={onReadingChange}
        fullWidth
        sx={{ mb: 3 }}
      />
      <Grid container spacing={2}>
        <Grid item>
          <Button variant="contained" onClick={onPrev} disabled={currentIndex === 0}>
            Prev
          </Button>
        </Grid>
        <Grid item>
          <Button variant="contained" onClick={onSubmit}>
            {currentIndex < totalMeters - 1 ? 'Next' : 'Finish'}
          </Button>
        </Grid>
      </Grid>
    </Paper>
  );
}

export default MeterScreen;

import React, { useState, useEffect } from "react";
import { Paper, Typography, Box, Button, TextField } from "@mui/material";

function MeterScreen({
  meter,
  currentIndex,
  totalMeters,
  onHome, // function to go home
  onPrev, // function to go to previous meter
  onNext, // function to go to next meter
  onFinish, // function to finish / go to summary
}) {
  // Create unique keys for this meter's reading and confirmation state.
  const readingKey = `meter_${meter.ID}_reading`;
  const confirmedKey = `meter_${meter.ID}_confirmed`;

  // Initialize state from localStorage
  const [reading, setReading] = useState(
    () => localStorage.getItem(readingKey) || ""
  );
  const [isConfirmed, setIsConfirmed] = useState(
    () => localStorage.getItem(confirmedKey) === "true"
  );

  // When the meter changes, update state from localStorage.
  useEffect(() => {
    setReading(localStorage.getItem(`meter_${meter.ID}_reading`) || "");
    setIsConfirmed(
      localStorage.getItem(`meter_${meter.ID}_confirmed`) === "true"
    );
  }, [meter]);

  // Persist reading and confirmation state to localStorage whenever they change.
  useEffect(() => {
    localStorage.setItem(readingKey, reading);
    localStorage.setItem(confirmedKey, isConfirmed);
  }, [reading, isConfirmed, readingKey, confirmedKey]);

  // Collect previous readings and compute average.
  const previousEntries = Object.entries(meter.readings)
    .filter(([k]) => k !== "ID")
    .sort((a, b) => a[0].localeCompare(b[0]));

  const previousValues = previousEntries.map(([_, val]) => Number(val) || 0);
  const averageReading = previousValues.length
    ? previousValues.reduce((sum, val) => sum + val, 0) / previousValues.length
    : 0;

  // Validation function for the reading input.
  const validateReading = (val) => {
    if (!val.trim()) {
      alert("Reading cannot be empty");
      return false;
    }
    const numVal = Number(val);
    if (isNaN(numVal) || numVal < 0) {
      alert("Reading must be a non-negative number");
      return false;
    }
    if (
      averageReading > 0 &&
      (numVal > averageReading * 2 || numVal < averageReading * 0.5)
    ) {
      const msg = `Reading ${numVal} is quite different from the average (${averageReading.toFixed(
        1
      )}). Are you sure?`;
      if (!window.confirm(msg)) {
        return false;
      }
    }
    return true;
  };

  const handleConfirm = () => {
    if (validateReading(reading)) {
      setIsConfirmed(true);
      // Optionally, notify a parent component of the confirmed reading.
    }
  };

  const handleEdit = () => {
    if (window.confirm("Are you sure you want to edit this reading?")) {
      setIsConfirmed(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !isConfirmed) {
      handleConfirm();
    }
  };

  // Determine button labels and actions.
  const leftButtonLabel = currentIndex === 0 ? "Home" : "Previous";
  const leftButtonAction = currentIndex === 0 ? onHome : onPrev;
  const rightButtonLabel = currentIndex < totalMeters - 1 ? "Next" : "Finish";
  const rightButtonAction = currentIndex < totalMeters - 1 ? onNext : onFinish;

  return (
    <Paper sx={{ p: 3, mb: 2 }}>
      {/* Top row with navigation buttons */}
      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}>
        <Button variant="outlined" onClick={leftButtonAction}>
          {leftButtonLabel}
        </Button>
        <Button variant="contained" onClick={rightButtonAction}>
          {rightButtonLabel}
        </Button>
      </Box>

      <Typography variant="h5" gutterBottom>
        Meter {meter.ID}
      </Typography>
      <Typography variant="subtitle1" gutterBottom>
        Address: {meter.ADDRESS}
      </Typography>

      <Box sx={{ mb: 3 }}>
        <Typography variant="h6">Previous Readings</Typography>
        {previousEntries.map(([dateKey, val]) => (
          <Typography key={dateKey} variant="body2">
            {dateKey}: {val}
          </Typography>
        ))}
      </Box>

      <TextField
        label="Enter Current Reading"
        type="number"
        value={reading}
        onChange={(e) => setReading(e.target.value)}
        onKeyDown={handleKeyDown}
        fullWidth
        sx={{ mb: 1 }}
        disabled={isConfirmed}
      />

      {!isConfirmed ? (
        <Button variant="contained" color="success" onClick={handleConfirm}>
          Confirm
        </Button>
      ) : (
        <Button variant="outlined" color="warning" onClick={handleEdit}>
          Edit
        </Button>
      )}
    </Paper>
  );
}

export default MeterScreen;

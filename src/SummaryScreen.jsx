import React from 'react';
import { Container, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Button, Box } from '@mui/material';

function SummaryScreen({ combinedMeters, submittedReadings, onMeterClick, onDownloadCSV, onRestart }) {
  // Map meter ID to submitted reading
  const readingMap = {};
  submittedReadings.forEach((r) => {
    readingMap[r.ID] = r.reading;
  });
  
  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 4 }}>
        <Typography variant="h4" gutterBottom>
          Summary
        </Typography>
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Meter ID</TableCell>
                <TableCell>Address</TableCell>
                <TableCell>Submitted Reading</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {combinedMeters.map((meter, index) => (
                <TableRow key={meter.ID} hover onClick={() => onMeterClick(index)} style={{ cursor: 'pointer' }}>
                  <TableCell>{meter.ID}</TableCell>
                  <TableCell>{meter.ADDRESS}</TableCell>
                  <TableCell>{readingMap[meter.ID] !== undefined ? readingMap[meter.ID] : '--'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between' }}>
          <Button variant="outlined" onClick={onRestart}>Restart</Button>
          <Button variant="contained" color="primary" onClick={onDownloadCSV}>Download CSV</Button>
        </Box>
      </Box>
    </Container>
  );
}

export default SummaryScreen;

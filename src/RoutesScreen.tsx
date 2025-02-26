import React from "react";
import { Container, Typography, Paper, Box } from "@mui/material";

const RoutesScreen: React.FC = () => {
  return (
    <Container>
      <Box sx={{ mt: 4 }}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h5" gutterBottom>
            Routes
          </Typography>
          <Typography>
            Route management functionality will be implemented here.
          </Typography>
        </Paper>
      </Box>
    </Container>
  );
};

export default RoutesScreen;

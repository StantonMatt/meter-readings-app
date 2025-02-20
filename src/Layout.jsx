// src/Layout.jsx
import React from 'react';
import {
  Drawer,
  Box,
  Card,
  CardContent,
  Typography,
  Toolbar
} from '@mui/material';

const drawerWidth = 240;

function Layout({ meters, currentIndex, onSelectMeter, children }) {
  return (
    <Box sx={{ display: 'flex' }}>
      {/* Permanent Drawer */}
      <Drawer
        variant="permanent"
        anchor="left"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            padding: '16px', // space around the cards
          },
        }}
      >
        <Toolbar>
          <Typography variant="h6" noWrap>
            Route
          </Typography>
        </Toolbar>

        {/* Scrollable container with right padding for the scrollbar */}
        <Box sx={{ overflowY: 'auto', mt: 2, pr: 1 }}>
          {meters.map((m, i) => {
            const isSelected = i === currentIndex;
            return (
              <Card
                key={m.ID}
                onClick={() => onSelectMeter(i)}
                sx={{
                  // Keep each card narrower so the scrollbar doesn't overlap
                  width: 'calc(100% - 8px)',
                  mb: 2,
                  cursor: 'pointer',
                  // Use a lighter gray or partial white background if you want contrast
                  // or just keep them dark if you prefer
                  bgcolor: isSelected ? 'primary.main' : 'rgba(255, 255, 255, 0.08)',
                  // Force text to be white (or use theme-based if you prefer)
                  color: isSelected ? 'primary.contrastText' : '#FFF',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                  },
                }}
              >
                <CardContent>
                  <Typography variant="body1" fontWeight="bold">
                    ID: {m.ID}
                  </Typography>
                  <Typography variant="body2">
                    {m.ADDRESS}
                  </Typography>
                </CardContent>
              </Card>
            );
          })}
        </Box>
      </Drawer>

      {/* Main content area */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <Box sx={{ width: '100%', maxWidth: 800 }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
}

export default Layout;

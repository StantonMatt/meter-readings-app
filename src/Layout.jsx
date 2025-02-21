// Layout.jsx
import React, { useState } from "react";
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Drawer,
  Box,
  Card,
  CardContent,
  TextField,
  InputAdornment,
  useMediaQuery,
  IconButton,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import MenuIcon from "@mui/icons-material/Menu";

const drawerWidth = 300;

function Layout({
  meters,
  currentIndex,
  onSelectMeter,
  onHomeClick,
  onFinishClick,
  children,
  showSidebar,
  readingsState,
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const isMobile = useMediaQuery((theme) => theme.breakpoints.down("md"));

  const handleDrawerToggle = () => {
    setMobileOpen((prev) => !prev);
  };

  // Filter meters if needed
  const filteredMeters = meters.filter((m) => {
    const idMatch = m.ID.toString().includes(searchTerm);
    const addressMatch = m.ADDRESS.toLowerCase().includes(
      searchTerm.toLowerCase()
    );
    return idMatch || addressMatch;
  });

  const drawerContent = (
    <Box sx={{ p: 2 }}>
      <TextField
        placeholder="Buscar por CLIENTE o Dirección"
        variant="outlined"
        size="small"
        fullWidth
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon sx={{ color: "#000" }} />
            </InputAdornment>
          ),
        }}
        sx={{
          mb: 2,
          "& .MuiOutlinedInput-root": {
            backgroundColor: "#FFFFFF",
            "& .MuiInputAdornment-root": {
              position: "absolute",
              left: "8px",
            },
            "& input": {
              paddingLeft: "20px",
            },
          },
          input: {
            color: "#000000",
          },
        }}
      />

      <Typography
        variant="h6"
        sx={{ mb: 2, fontWeight: "bold", color: "#FFFFFF" }}
      >
        Ruta
      </Typography>

      {filteredMeters.map((m, i) => {
        const isSelected = i === currentIndex;
        const meterState = readingsState[m.ID] || {};
        const currentReading =
          meterState.reading || localStorage.getItem(`meter_${m.ID}_reading`);
        const isConfirmed =
          meterState.isConfirmed ||
          localStorage.getItem(`meter_${m.ID}_confirmed`) === "true";

        return (
          <Card
            key={m.ID}
            onClick={() => onSelectMeter(i)}
            sx={{
              mb: 2,
              cursor: "pointer",
              background: "linear-gradient(145deg, #121621, #1B2230)",
              color: "#FFFFFF",
              border: isSelected ? "1px solid #FFFFFF" : "1px solid #1F2533",
              transition: "box-shadow 0.2s ease",
              maxWidth: "260px", // Increased to fit in wider drawer
              mx: "auto",
              "&:hover": {
                boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
              },
            }}
          >
            <CardContent>
              <Typography variant="body1" fontWeight="bold" color="inherit">
                CLIENTE: {m.ID}
              </Typography>
              <Typography variant="body2" color="inherit" sx={{ mb: 1 }}>
                {m.ADDRESS}
              </Typography>
              {currentReading && (
                <Typography
                  variant="body2"
                  color="inherit"
                  sx={{
                    color: isConfirmed ? "#10B981" : "#FCD34D",
                    fontWeight: "bold",
                  }}
                >
                  Lectura: {currentReading}
                  {isConfirmed ? " ✓" : " (pendiente)"}
                </Typography>
              )}
            </CardContent>
          </Card>
        );
      })}
    </Box>
  );

  return (
    <Box sx={{ display: "flex" }}>
      {/* Full-width top bar, visible on all pages */}
      <AppBar
        position="fixed"
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 1,
          backgroundColor: "#121621", // Match sidebar color
        }}
      >
        <Toolbar>
          {/* Add Menu button that only shows on mobile when sidebar is enabled */}
          {showSidebar && (
            <IconButton
              color="inherit"
              aria-label="open drawer"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 2, display: { md: "none" } }} // Only show below md breakpoint
            >
              <MenuIcon />
            </IconButton>
          )}

          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            COAB Lectura de Medidores
          </Typography>

          {/* "Home" button => onHomeClick */}
          <Button color="inherit" onClick={onHomeClick} sx={{ mr: 2 }}>
            Inicio
          </Button>

          {/* "Finish" button => onFinishClick */}
          <Button color="inherit" onClick={onFinishClick}>
            Finalizar
          </Button>
        </Toolbar>
      </AppBar>

      {/* Conditionally render the Drawer (sidebar) only if showSidebar === true */}
      {showSidebar && (
        <Drawer
          variant={isMobile ? "temporary" : "permanent"}
          open={isMobile ? mobileOpen : true}
          onClose={handleDrawerToggle}
          sx={{
            width: drawerWidth,
            flexShrink: 0,
            "& .MuiDrawer-paper": {
              width: drawerWidth,
              boxSizing: "border-box",
              backgroundColor: "#121621",
            },
          }}
        >
          {/* Spacer to push sidebar content below the top bar */}
          <Toolbar />
          {drawerContent}
        </Drawer>
      )}

      {/* Main content area */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: showSidebar
            ? { xs: "100%", md: `calc(100% - ${drawerWidth}px)` }
            : "100%",
        }}
      >
        {/* Extra toolbar to offset content under top bar */}
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
}

export default Layout;

// Layout.jsx
import React, { useState, useCallback, useMemo } from "react";
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
import TopBar from "./TopBar";

const drawerWidth = 300;

// Move outside component to avoid recreation
const prepareMeterForSearch = (meter) => ({
  ...meter,
  searchString: `${meter.ID} ${meter.ADDRESS.toLowerCase()}`,
  idString: meter.ID.toString(),
});

function MeterList({
  filteredMeters,
  currentIndex,
  onSelectMeter,
  readingsState,
  searchTerm,
  onSearchChange,
  isMobile,
  onNavigationAttempt,
}) {
  // Memoize the list items to prevent unnecessary re-renders
  const listItems = useMemo(
    () =>
      filteredMeters.map((m, i) => {
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
            onClick={() => onNavigationAttempt(() => onSelectMeter(i))}
            sx={{
              mb: 2,
              cursor: "pointer",
              background: "linear-gradient(145deg, #121621, #1B2230)",
              color: "#FFFFFF",
              border: isSelected ? "1px solid #FFFFFF" : "1px solid #1F2533",
              transition: "box-shadow 0.2s ease",
              width: "260px",
              mx: "4px",
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
      }),
    [
      filteredMeters,
      currentIndex,
      readingsState,
      onSelectMeter,
      onNavigationAttempt,
    ]
  );

  return (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#0A0E17",
      }}
    >
      {isMobile && (
        <Box sx={{ p: 2, pt: 3 }}>
          <TextField
            placeholder="Buscar Cliente"
            variant="outlined"
            size="small"
            fullWidth
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
              sx: {
                backgroundColor: "white",
                borderRadius: 1,
                "&:hover": {
                  backgroundColor: "white",
                },
              },
            }}
          />
        </Box>
      )}
      <Box
        sx={{
          flexGrow: 1,
          overflowY: "auto",
          px: 1,
          pt: 2,
          pb: 2,
        }}
      >
        {listItems}
      </Box>
    </Box>
  );
}

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
  const isMobile = useMediaQuery((theme) => theme.breakpoints.down("sm"));

  // Pre-process meters data once
  const processedMeters = useMemo(
    () => meters.map(prepareMeterForSearch),
    [meters]
  );

  // Optimize search with memoization and pre-processed data
  const filteredMeters = useMemo(() => {
    if (!searchTerm) return processedMeters;
    const searchLower = searchTerm.toLowerCase();

    // Fast path for ID-only search
    if (/^\d+$/.test(searchTerm)) {
      return processedMeters.filter((m) => m.idString.includes(searchTerm));
    }

    // Full search
    return processedMeters.filter((m) => m.searchString.includes(searchLower));
  }, [processedMeters, searchTerm]);

  const handleDrawerToggle = useCallback(() => {
    setMobileOpen((prev) => !prev);
  }, []);

  const handleSearchChange = useCallback((value) => {
    setSearchTerm(value);
  }, []);

  // Update navigation attempt handler
  const handleNavigationAttempt = useCallback((navigationFunction) => {
    // Execute the navigation function directly
    // MeterScreen will handle the confirmation dialog if needed
    navigationFunction();
  }, []);

  // Wrap navigation handlers
  const handleHomeClick = useCallback(() => {
    handleNavigationAttempt(onHomeClick);
  }, [onHomeClick, handleNavigationAttempt]);

  const handleFinishClick = useCallback(() => {
    handleNavigationAttempt(onFinishClick);
  }, [onFinishClick, handleNavigationAttempt]);

  const handleSelectMeter = useCallback(
    (index) => {
      handleNavigationAttempt(() => onSelectMeter(index));
    },
    [onSelectMeter, handleNavigationAttempt]
  );

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <TopBar
        onHomeClick={handleHomeClick}
        onSummaryClick={handleFinishClick}
        showButtons={currentIndex !== null}
        currentScreen={
          currentIndex >= 0 && currentIndex < meters.length
            ? "meter"
            : currentIndex >= meters.length
            ? "summary"
            : "home"
        }
        onMenuClick={handleDrawerToggle}
        showMenuButton={showSidebar && isMobile}
        searchTerm={searchTerm}
        onSearchChange={handleSearchChange}
        isMobile={isMobile}
      />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          display: "flex",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {showSidebar && currentIndex >= 0 && currentIndex < meters.length && (
          <>
            {/* Desktop sidebar */}
            <Box
              component="nav"
              sx={{
                width: drawerWidth,
                flexShrink: 0,
                display: { xs: "none", sm: "block" },
                borderRight: "1px solid rgba(0, 0, 0, 0.12)",
                height: "100%",
              }}
            >
              <MeterList
                filteredMeters={filteredMeters}
                currentIndex={currentIndex}
                onSelectMeter={handleSelectMeter}
                readingsState={readingsState}
                searchTerm={searchTerm}
                onSearchChange={handleSearchChange}
                isMobile={false}
                onNavigationAttempt={handleNavigationAttempt}
              />
            </Box>

            {/* Mobile drawer */}
            <Drawer
              variant="temporary"
              open={mobileOpen}
              onClose={handleDrawerToggle}
              ModalProps={{
                keepMounted: true,
              }}
              sx={{
                display: { xs: "block", sm: "none" },
                "& .MuiDrawer-paper": {
                  boxSizing: "border-box",
                  width: drawerWidth,
                  backgroundColor: "#0A0E17",
                },
              }}
              SlideProps={{
                tabIndex: -1,
              }}
              keepMounted={false}
              disableEnforceFocus
              disableRestoreFocus
            >
              <MeterList
                filteredMeters={filteredMeters}
                currentIndex={currentIndex}
                onSelectMeter={handleSelectMeter}
                readingsState={readingsState}
                searchTerm={searchTerm}
                onSearchChange={handleSearchChange}
                isMobile={true}
                onNavigationAttempt={handleNavigationAttempt}
              />
            </Drawer>
          </>
        )}
        <Box
          sx={{
            flexGrow: 1,
            p: 3,
            pl: { sm: showSidebar && currentIndex < meters.length ? 3 : 3 },
            overflow: "auto",
            height: "100%",
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
}

export default Layout;

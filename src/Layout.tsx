// Layout.tsx
import React, { useState, useCallback, useMemo, ReactNode } from "react";
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
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  useTheme,
  CssBaseline,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import MenuIcon from "@mui/icons-material/Menu";
import TopBar from "./TopBar";
import { MeterData, ReadingsState } from "./utils/readingUtils";
import { useLocation } from "react-router-dom";

const drawerWidth = 300;

interface SearchableMeter extends MeterData {
  searchString: string;
  idString: string;
}

// Move outside component to avoid recreation
const prepareMeterForSearch = (meter: MeterData): SearchableMeter => ({
  ...meter,
  searchString: `${meter.ID} ${meter.ADDRESS.toLowerCase()}`,
  idString: meter.ID.toString(),
});

interface MeterListProps {
  filteredMeters: SearchableMeter[];
  currentIndex: number;
  onSelectMeter: (index: number) => void;
  readingsState: ReadingsState;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  isMobile: boolean;
  onNavigationAttempt?: () => void;
  meters: MeterData[];
}

function MeterList({
  filteredMeters,
  currentIndex,
  onSelectMeter,
  readingsState,
  searchTerm,
  onSearchChange,
  isMobile,
  onNavigationAttempt,
  meters,
}: MeterListProps) {
  // Memoize the list items to prevent unnecessary re-renders
  const listItems = useMemo(
    () =>
      filteredMeters.map((m) => {
        const originalIndex = meters.findIndex((meter) => meter.ID === m.ID);
        const isSelected = originalIndex === currentIndex;
        const reading = readingsState[m.ID];
        const isConfirmed = reading?.isConfirmed;
        const hasReading = reading?.reading;

        // Background color based on state
        let backgroundColor = isSelected
          ? "rgba(80, 72, 229, 0.08)"
          : "transparent";
        let textColor = "text.primary";
        let borderLeft = isSelected
          ? "4px solid #5048E5"
          : "4px solid transparent";

        // Add color coding for confirmed readings
        if (isConfirmed) {
          textColor = "success.main";
        } else if (hasReading) {
          textColor = "warning.main";
        }

        return (
          <ListItem key={m.ID} disablePadding>
            <ListItemButton
              selected={isSelected}
              onClick={() => onSelectMeter(originalIndex)}
              sx={{
                backgroundColor,
                borderLeft,
                "&:hover": {
                  backgroundColor: "rgba(80, 72, 229, 0.04)",
                },
              }}
            >
              <ListItemText
                primary={m.ID}
                secondary={m.ADDRESS}
                primaryTypographyProps={{
                  color: textColor,
                  fontWeight: isSelected ? "bold" : "normal",
                }}
                secondaryTypographyProps={{
                  noWrap: true,
                  sx: { maxWidth: "100%" },
                }}
              />
            </ListItemButton>
          </ListItem>
        );
      }),
    [filteredMeters, currentIndex, readingsState, onSelectMeter, meters]
  );

  return (
    <Box
      sx={{
        overflowY: "auto",
        flex: "1 1 auto",
        height: isMobile ? "calc(100vh - 56px)" : "calc(100vh - 64px)",
      }}
    >
      <Box
        sx={{
          p: 2,
          position: "sticky",
          top: 0,
          zIndex: 1,
          bgcolor: "background.paper",
        }}
      >
        <TextField
          fullWidth
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Buscar medidor..."
          variant="outlined"
          size="small"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
      </Box>
      <List>{listItems}</List>
    </Box>
  );
}

interface LayoutProps {
  children: ReactNode;
  showSidebar?: boolean;
  meters: MeterData[];
  currentIndex: number;
  onSelectMeter: (index: number) => void;
  onHomeClick: () => void;
  onFinishClick: () => void;
  readingsState: ReadingsState;
}

const Layout: React.FC<LayoutProps> = ({
  children,
  showSidebar,
  meters,
  currentIndex,
  onSelectMeter,
  onHomeClick,
  onFinishClick,
  readingsState,
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down("sm"));

  // Use try/catch to handle useLocation errors
  let pathname = "";
  try {
    const location = useLocation();
    pathname = location.pathname;
  } catch (error) {
    console.warn("useLocation failed, likely not in Router context", error);
  }

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", width: "100%" }}>
      <CssBaseline />

      {/* App Bar */}
      <TopBar onMenuClick={handleDrawerToggle} onHomeClick={onHomeClick} />

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          padding: theme.spacing(3),
          marginTop: "64px", // Height of AppBar
          backgroundColor: theme.palette.background.default,
          overflowX: "hidden",
        }}
      >
        {children}
      </Box>
    </Box>
  );
};

export default Layout;

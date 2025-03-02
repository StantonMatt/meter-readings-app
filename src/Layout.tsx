// Layout.tsx
import React, { useState, useCallback, useMemo } from "react";
import {
  Typography,
  Drawer,
  Box,
  TextField,
  InputAdornment,
  useMediaQuery,
  ListItem,
  ListItemButton,
  ListItemText,
  useTheme,
  CssBaseline,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import TopBar from "./TopBar";
import { MeterData, ReadingsState } from "./utils/readingUtils";
import { FixedSizeList, ListChildComponentProps } from "react-window";
import { startTransition } from "react";
import { getMeterReading } from "./utils/readingUtils";
import { alpha } from "@mui/material/styles";
import { palette } from "./theme";

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

// Debounce function to improve search performance
function useDebounce<T extends (...args: any[]) => void>(
  callback: T,
  delay: number
): T {
  const timeoutRef = React.useRef<number | null>(null);

  const debouncedCallback = React.useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = window.setTimeout(() => {
        callback(...args);
      }, delay);
    },
    [callback, delay]
  ) as T;

  return debouncedCallback;
}

// Use a type for this data prop to enforce consistency
type MeterRowData = {
  items: SearchableMeter[];
  currentIndex: number;
  onSelect: (index: number) => void;
  readingsState: ReadingsState;
  meters: MeterData[];
  onNavigationAttempt: (callback: () => void) => void;
  isMobile: boolean;
  onDrawerClose: () => void;
};

interface MeterListProps {
  filteredMeters: SearchableMeter[];
  currentIndex: number;
  onSelectMeter: (index: number) => void;
  readingsState: ReadingsState;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  isMobile: boolean;
  onNavigationAttempt: (callback: () => void) => void;
  meters: MeterData[];
  isMeterScreen: boolean;
  onDrawerClose: () => void;
}

// Virtualized row renderer for meter list
const MeterRow = React.memo(
  ({
    data,
    index,
    style,
  }: ListChildComponentProps & {
    data: MeterRowData;
  }) => {
    const theme = useTheme();
    const {
      items,
      currentIndex,
      onSelect,
      readingsState,
      meters,
      onNavigationAttempt,
      isMobile,
      onDrawerClose,
    } = data;
    const meter = items[index];
    const originalIndex = meters.findIndex((m: MeterData) => m.ID === meter.ID);
    const isSelected = originalIndex === currentIndex;
    const reading = readingsState[meter.ID];
    const isConfirmed = reading?.isConfirmed;
    const hasReading = reading?.reading;
    const meterData = getMeterReading(meter.ID);
    const consumptionType = meterData?.consumption?.type;

    // Determine color based on consumption type
    const getReadingColor = () => {
      if (!hasReading) return theme.palette.text.secondary;
      if (!isConfirmed) return palette.semantic.warning.main;

      switch (consumptionType) {
        case "normal":
          return palette.consumption.normal.main;
        case "low":
          return palette.consumption.low.main;
        case "high":
          return palette.consumption.high.main;
        case "negative":
          return palette.consumption.negative.main;
        case "estimated":
          return palette.consumption.estimated.main;
        default:
          return palette.consumption.normal.main;
      }
    };

    // Determine background color based on consumption type
    const getReadingBackgroundColor = () => {
      if (!hasReading) return "transparent";
      if (!isConfirmed) return alpha(palette.semantic.warning.main, 0.12);

      switch (consumptionType) {
        case "normal":
          return alpha(palette.consumption.normal.main, 0.12);
        case "low":
          return alpha(palette.consumption.low.main, 0.12);
        case "high":
          return alpha(palette.consumption.high.main, 0.12);
        case "negative":
          return alpha(palette.consumption.negative.main, 0.12);
        case "estimated":
          return alpha(palette.consumption.estimated.main, 0.12);
        default:
          return alpha(palette.consumption.normal.main, 0.12);
      }
    };

    const handleClick = () => {
      if (isSelected) return;

      // Use navigation attempt handler to navigate to the selected meter
      onNavigationAttempt(() => {
        onSelect(originalIndex);
        // Close the drawer on narrow screens
        if (isMobile) {
          onDrawerClose();
        }
      });
    };

    return (
      <ListItem
        disablePadding
        style={{
          ...style,
          height: 80,
          position: "absolute",
          top: style.top,
          left: 0,
          width: "100%",
          transform: "translateY(-1px)",
        }}
        sx={{
          backgroundColor: isSelected
            ? "rgba(255, 255, 255, 0.08)"
            : "transparent",
          transition: "background-color 0.2s ease",
          padding: 0,
          margin: 0,
          borderBottom: "1px solid rgba(255, 255, 255, 0.04)",
          "&:last-child": {
            borderBottom: "none",
          },
        }}
      >
        <ListItemButton
          sx={{
            transition: "all 0.15s ease-in-out",
            borderRadius: 0,
            margin: 0,
            padding: "12px 16px",
            height: "100%",
            width: "100%",
            borderLeft: isSelected ? "2px solid" : "2px solid transparent",
            borderLeftColor: isSelected ? "#ffffff" : "transparent",
            "&:hover": {
              backgroundColor: "rgba(255, 255, 255, 0.04)",
            },
          }}
          onClick={handleClick}
        >
          <ListItemText
            primary={
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  minHeight: "48px",
                }}
              >
                <Box sx={{ flex: 1 }}>
                  <Typography
                    variant="body1"
                    component="span"
                    sx={{
                      fontWeight: isSelected ? 600 : 500,
                      color: isSelected ? "#ffffff" : "rgba(255,255,255,0.9)",
                      fontSize: "0.9rem",
                      letterSpacing: "0.01em",
                      display: "block",
                      mb: 0.5,
                    }}
                  >
                    {meter.ID}
                  </Typography>
                  <Typography
                    variant="body2"
                    component="span"
                    sx={{
                      color: "rgba(255,255,255,0.65)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      maxWidth: "100%",
                      fontSize: "0.75rem",
                      display: "block",
                    }}
                  >
                    {meter.ADDRESS}
                  </Typography>
                </Box>
                {hasReading && (
                  <Box
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      border: "1px solid",
                      borderColor: alpha(getReadingColor(), 0.08),
                      background: `linear-gradient(${alpha(
                        getReadingColor(),
                        0.2
                      )}, ${alpha(getReadingColor(), 0.3)}), #FFFFFF`,
                      borderRadius: "13px",
                      px: 1.5,
                      py: 0.75,
                      minWidth: "80px",
                      ml: 1.5,
                      alignSelf: "center",
                    }}
                  >
                    <Typography
                      variant="body2"
                      component="span"
                      sx={{
                        color: getReadingColor(),
                        fontWeight: 700,
                        fontSize: "0.85rem",
                        lineHeight: 1.2,
                        textAlign: "center",
                      }}
                    >
                      {reading.reading}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        color: alpha(getReadingColor(), 0.9),
                        fontWeight: 600,
                        fontSize: "0.65rem",
                        lineHeight: 1.2,
                        textAlign: "center",
                      }}
                    >
                      {isConfirmed ? "Confirmado" : "Pendiente"}
                    </Typography>
                  </Box>
                )}
              </Box>
            }
            primaryTypographyProps={{
              sx: { mb: 0 },
            }}
            secondaryTypographyProps={{
              sx: { mt: 0 },
            }}
          />
        </ListItemButton>
      </ListItem>
    );
  }
);

function MeterList({
  filteredMeters,
  currentIndex,
  onSelectMeter,
  readingsState,
  searchTerm,
  onSearchChange,
  onNavigationAttempt,
  meters,
  isMeterScreen,
  onDrawerClose,
  isMobile,
}: MeterListProps) {
  // Create a ref for the container
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [listHeight, setListHeight] = useState(500); // Default fallback height

  // Use the useEffect hook to measure and update the container's height
  React.useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        // Get viewport height
        const viewportHeight = window.innerHeight;
        // Calculate height (subtract search bar + app bar)
        const searchBarHeight = isMeterScreen ? 64 : 0;
        const appBarHeight = 64;
        const newHeight = viewportHeight - searchBarHeight - appBarHeight;
        setListHeight(newHeight);
      }
    };

    // Initial measurement
    updateHeight();

    // Re-measure on resize
    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, [isMeterScreen]);

  // Use debounce with startTransition for search input
  const debouncedSearchChange = useDebounce((value: string) => {
    startTransition(() => {
      onSearchChange(value);
    });
  }, 150);

  const handleSearchChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      debouncedSearchChange(value);
    },
    [debouncedSearchChange]
  );

  const listData = {
    items: filteredMeters,
    currentIndex,
    onSelect: onSelectMeter,
    readingsState: readingsState || {},
    meters,
    onNavigationAttempt,
    isMobile,
    onDrawerClose,
  };

  return (
    <Box
      sx={{ display: "flex", flexDirection: "column", height: "100%" }}
      ref={containerRef}
    >
      {/* Search bar - only show on meter screen */}
      {isMeterScreen && (
        <Box
          sx={{
            p: 2,
            position: "sticky",
            top: 0,
            zIndex: 1,
            backgroundColor: "transparent",
            borderBottom: "none",
          }}
        >
          <TextField
            fullWidth
            placeholder="Buscar medidor..."
            size="small"
            onChange={handleSearchChange}
            defaultValue={searchTerm}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: "rgba(0, 0, 0, 0.8)" }} />
                </InputAdornment>
              ),
              sx: {
                color: "rgba(0, 0, 0, 0.95)",
                fontWeight: 700,
                "& .MuiOutlinedInput-notchedOutline": {
                  borderColor: "rgba(0, 0, 0, 0.3)",
                },
                "&:hover .MuiOutlinedInput-notchedOutline": {
                  borderColor: "rgba(0, 0, 0, 0.5)",
                },
                "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                  borderColor: "rgba(0, 0, 0, 0.7)",
                },
                "& .MuiInputBase-input::placeholder": {
                  color: "rgba(0, 0, 0, 0.8)",
                  fontWeight: 600,
                  fontStyle: "italic",
                },
              },
            }}
            sx={{
              "& .MuiInputBase-root": {
                backgroundColor: "rgba(255, 255, 255, 0.4)",
                borderRadius: 2,
                transition: "all 0.2s ease",
                "&:hover": {
                  backgroundColor: "rgba(255, 255, 255, 0.5)",
                },
              },
            }}
          />
        </Box>
      )}

      {/* Meter list */}
      <Box sx={{ flexGrow: 1, overflow: "hidden" }}>
        {filteredMeters.length > 0 ? (
          <FixedSizeList
            height={listHeight}
            width="100%"
            itemSize={80}
            itemCount={filteredMeters.length}
            itemData={listData as MeterRowData}
            overscanCount={8}
          >
            {MeterRow}
          </FixedSizeList>
        ) : (
          <Box sx={{ p: 2, textAlign: "center" }}>
            <Typography sx={{ color: "rgba(255,255,255,0.7)" }}>
              No se encontraron medidores
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}

interface LayoutProps {
  children: React.ReactNode;
  showSidebar?: boolean;
  title?: string;
  subtitle?: string;
  onFinishClick?: () => void;
  readingsState?: ReadingsState;
  onNavigationAttempt: (navigationCallback: () => void) => void;
  meters: MeterData[];
  currentIndex: number;
  onSelectMeter: (index: number) => void;
  onHomeClick: () => void;
}

const Layout: React.FC<LayoutProps> = ({
  children,
  showSidebar = true,
  readingsState,
  onNavigationAttempt,
  meters,
  currentIndex,
  onSelectMeter,
  onHomeClick,
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down("md"));
  const [searchTerm, setSearchTerm] = useState("");

  // Now currentIndex and meters will be properly defined
  const isMeterScreen = currentIndex >= 0 && currentIndex < meters.length;

  const handleDrawerToggle = useCallback(() => {
    setMobileOpen((prev) => !prev);
  }, []);

  // Add this function near the other handlers in Layout.tsx
  const handleNavigationAttempt = useCallback(
    (navigationCallback: () => void) => {
      // Pass it through to the parent's onNavigationAttempt
      if (onNavigationAttempt) {
        onNavigationAttempt(navigationCallback);
      } else {
        // If no parent handler, just execute the navigation
        navigationCallback();
      }
    },
    [onNavigationAttempt]
  );

  // Create searchable meters once with memoization
  const searchableMeters = useMemo(
    () => meters.map(prepareMeterForSearch),
    [meters]
  );

  // Filter meters based on search term
  const filteredMeters = useMemo(() => {
    if (!searchTerm.trim()) {
      return searchableMeters;
    }
    const lowerSearchTerm = searchTerm.toLowerCase();
    return searchableMeters.filter(
      (meter) =>
        meter.searchString.includes(lowerSearchTerm) ||
        meter.idString.includes(lowerSearchTerm)
    );
  }, [searchableMeters, searchTerm]);

  // Memoize drawer content to prevent unnecessary rerenders
  const drawerContent = useMemo(
    () => (
      <MeterList
        filteredMeters={filteredMeters}
        currentIndex={currentIndex}
        onSelectMeter={onSelectMeter}
        readingsState={readingsState || {}}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        isMobile={isSmallScreen}
        meters={meters}
        onNavigationAttempt={handleNavigationAttempt}
        isMeterScreen={isMeterScreen}
        onDrawerClose={handleDrawerToggle}
      />
    ),
    [
      filteredMeters,
      currentIndex,
      onSelectMeter,
      readingsState,
      searchTerm,
      isSmallScreen,
      meters,
      isMeterScreen,
      handleNavigationAttempt,
      handleDrawerToggle,
    ]
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", width: "100%" }}>
      <CssBaseline />

      {/* App Bar */}
      <TopBar
        onMenuClick={handleDrawerToggle}
        onHomeClick={() => {
          handleNavigationAttempt(() => onHomeClick());
        }}
        showMenuButton={showSidebar}
        showButtons={true}
        isMobile={isSmallScreen}
      />

      {/* Sidebar Drawer - only show if showSidebar is true */}
      {showSidebar && (
        <>
          {/* Mobile/Narrow Screen drawer */}
          <Drawer
            variant="temporary"
            open={mobileOpen}
            onClose={handleDrawerToggle}
            ModalProps={{
              keepMounted: true, // Better mobile performance
            }}
            sx={{
              display: { xs: "block", md: "none" },
              "& .MuiDrawer-paper": {
                boxSizing: "border-box",
                width: drawerWidth,
                backgroundColor: "primary.main",
              },
            }}
          >
            {drawerContent}
          </Drawer>

          {/* Desktop drawer */}
          <Drawer
            variant="permanent"
            sx={{
              display: { xs: "none", md: "block" },
              "& .MuiDrawer-paper": {
                boxSizing: "border-box",
                width: drawerWidth,
                marginTop: "64px",
                height: "calc(100% - 64px)",
                background: "primary.main",
                borderRadius: 0,
              },
              flexShrink: 0,
            }}
            open
          >
            {drawerContent}
          </Drawer>
        </>
      )}

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: {
            xs: "100%",
            md: showSidebar ? `calc(100% - ${drawerWidth}px)` : "100%",
          },
          padding: theme.spacing(3),
          marginTop: "64px",
          marginLeft: { xs: 0, md: showSidebar ? `${drawerWidth}px` : 0 },
          backgroundColor: theme.palette.background.default,
          overflowX: "hidden",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <Box
          sx={{
            width: "100%",
            maxWidth: "800px",
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
};

export default Layout;

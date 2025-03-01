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
import { useDeferredValue, startTransition } from "react";

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
    const {
      items,
      currentIndex,
      onSelect,
      readingsState,
      meters,
      onNavigationAttempt,
    } = data;
    const meter = items[index];
    const originalIndex = meters.findIndex((m: MeterData) => m.ID === meter.ID);
    const isSelected = originalIndex === currentIndex;
    const reading = readingsState[meter.ID];
    const isConfirmed = reading?.isConfirmed;
    const hasReading = reading?.reading;

    let statusColor = "text.secondary";
    let statusBgColor = "transparent";
    let statusBadge = null;

    if (hasReading && isConfirmed) {
      statusColor = "success.main";
      statusBgColor = "rgba(16, 185, 129, 0.1)";
      statusBadge = "Confirmado";
    } else if (hasReading) {
      statusColor = "warning.main";
      statusBgColor = "rgba(245, 158, 11, 0.1)";
      statusBadge = "Pendiente";
    }

    const handleClick = () => {
      if (isSelected) return;

      // Use navigation attempt handler to navigate to the selected meter
      onNavigationAttempt(() => onSelect(originalIndex));
    };

    return (
      <ListItem
        disablePadding
        style={{
          ...style,
          paddingTop: 2,
          paddingBottom: 2,
        }}
        sx={{
          backgroundColor: isSelected
            ? "rgba(255, 255, 255, 0.08)"
            : "transparent",
          transition: "background-color 0.2s ease",
        }}
      >
        <ListItemButton
          sx={{
            py: 1,
            px: 2,
            transition: "all 0.15s ease-in-out",
            borderRadius: 0,
            margin: 0,
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
                  alignItems: "center",
                }}
              >
                <Typography
                  variant="body1"
                  component="span"
                  sx={{
                    fontWeight: isSelected ? 600 : 500,
                    color: isSelected ? "#ffffff" : "rgba(255,255,255,0.9)",
                    fontSize: "0.9rem",
                    letterSpacing: "0.01em",
                  }}
                >
                  {meter.ID}
                </Typography>
                {hasReading && (
                  <Box
                    sx={{
                      backgroundColor: isConfirmed
                        ? "rgba(16, 185, 129, 0.12)"
                        : "rgba(245, 158, 11, 0.12)",
                      borderRadius: "2px",
                      px: 1,
                      py: 0.25,
                      display: "flex",
                      alignItems: "center",
                      ml: 1,
                    }}
                  >
                    <Typography
                      variant="body2"
                      component="span"
                      sx={{
                        color: isConfirmed ? "#10b981" : "#f59e0b",
                        fontWeight: 500,
                        fontSize: "0.7rem",
                      }}
                    >
                      {reading.reading}
                    </Typography>
                  </Box>
                )}
              </Box>
            }
            secondary={
              <Box
                component="span"
                sx={{
                  mt: 0.25,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Typography
                  variant="body2"
                  component="span"
                  sx={{
                    color: "rgba(255,255,255,0.65)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    maxWidth: statusBadge ? "70%" : "100%",
                    fontSize: "0.75rem",
                  }}
                >
                  {meter.ADDRESS}
                </Typography>
                {statusBadge && (
                  <Typography
                    variant="caption"
                    component="span"
                    sx={{
                      backgroundColor: isConfirmed
                        ? "rgba(16, 185, 129, 0.12)"
                        : "rgba(245, 158, 11, 0.12)",
                      color: isConfirmed ? "#10b981" : "#f59e0b",
                      borderRadius: "2px",
                      px: 0.75,
                      py: 0.1,
                      fontSize: "0.6rem",
                      fontWeight: 600,
                      ml: 0.5,
                    }}
                  >
                    {statusBadge}
                  </Typography>
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
  isMobile,
  onNavigationAttempt,
  meters,
  isMeterScreen,
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

  // Create a deferred value for search term to prevent UI freeze
  const deferredSearchTerm = useDeferredValue(searchTerm);

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
            itemSize={64}
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
  title,
  subtitle,
  onFinishClick,
  readingsState,
  onNavigationAttempt,
  meters,
  currentIndex,
  onSelectMeter,
  onHomeClick,
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down("sm"));
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
        showMenuButton={true}
        showButtons={true}
        isMobile={isSmallScreen}
      />

      {/* Sidebar Drawer - only show if showSidebar is true */}
      {showSidebar && (
        <>
          {/* Mobile drawer */}
          <Drawer
            variant="temporary"
            open={mobileOpen}
            onClose={handleDrawerToggle}
            ModalProps={{
              keepMounted: true, // Better mobile performance
            }}
            sx={{
              display: { xs: "block", sm: "none" },
              "& .MuiDrawer-paper": {
                boxSizing: "border-box",
                width: drawerWidth,
                backgroundColor: "primary.main", // Darkish blue/grey
              },
            }}
          >
            {drawerContent}
          </Drawer>

          {/* Desktop drawer */}
          <Drawer
            variant="permanent"
            sx={{
              display: { xs: "none", sm: "block" },
              "& .MuiDrawer-paper": {
                boxSizing: "border-box",
                width: drawerWidth,
                marginTop: "64px",
                height: "calc(100% - 64px)",
                background: "primary.main",
                borderRadius: 0,
              },
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
            sm: showSidebar ? `calc(100% - ${drawerWidth}px)` : "100%",
          },
          padding: theme.spacing(3),
          marginTop: "64px", // Height of AppBar
          backgroundColor: theme.palette.background.default, // Light grey background
          overflowX: "hidden",
        }}
      >
        {children}
      </Box>
    </Box>
  );
};

export default Layout;

// App.jsx
import React, { useState, useCallback, useEffect } from "react";
import Layout from "./Layout";
import HomeScreen from "./HomeScreen";
import MeterScreen from "./MeterScreen";
import FinalCheckScreen from "./FinalCheckScreen";
import SummaryScreen from "./SummaryScreen";
import routeData from "./data/route.json";
import readingsData from "./data/readings.json";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
} from "@mui/material";
import { db, storage, auth } from "./firebase-config";
import { collection, getDocs, doc, setDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

// Merge route + reading data
const combinedMeters = routeData.map((meter) => {
  const matchingReading = readingsData.find((r) => r.ID === meter.ID);
  return { ...meter, readings: matchingReading || {} };
});

function App() {
  const [currentIndex, setCurrentIndex] = useState(null);
  const [submittedReadings, setSubmittedReadings] = useState([]);
  const [restartDialogOpen, setRestartDialogOpen] = useState(false);
  const [restartConfirmation, setRestartConfirmation] = useState("");
  const [availableRoutes, setAvailableRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [previousReadings, setPreviousReadings] = useState(null);

  // Initialize readingsState from localStorage
  const [readingsState, setReadingsState] = useState(() => {
    const initialState = {};
    combinedMeters.forEach((meter) => {
      const reading = localStorage.getItem(`meter_${meter.ID}_reading`);
      const isConfirmed =
        localStorage.getItem(`meter_${meter.ID}_confirmed`) === "true";
      if (reading || isConfirmed) {
        initialState[meter.ID] = {
          reading: reading || "",
          isConfirmed: isConfirmed,
        };
      }
    });
    return initialState;
  });

  // Cargar rutas disponibles al inicio
  useEffect(() => {
    const loadRoutes = async () => {
      try {
        const routesSnapshot = await getDocs(collection(db, "routes"));
        setAvailableRoutes(routesSnapshot.docs.map((doc) => doc.data()));
      } catch (error) {
        console.error("Error loading routes:", error);
        // Set some default routes or show error message
        setAvailableRoutes([
          { name: "ruta1", lastUpdated: new Date().toISOString() },
        ]);
      }
    };
    loadRoutes();
  }, []);

  // Nuevo método para cargar lecturas previas
  const loadPreviousReadings = async (routeName) => {
    const storageRef = ref(storage, `readings/${routeName}_latest.json`);
    const url = await getDownloadURL(storageRef);
    const response = await fetch(url);
    return await response.json();
  };

  const handleHomeClick = () => {
    setCurrentIndex(null);
  };

  const handleFinishClick = async () => {
    // Check for missing and unconfirmed readings
    const missingReadings = [];
    const unconfirmedReadings = [];

    combinedMeters.forEach((meter) => {
      const meterState = readingsState[meter.ID] || {};
      const reading =
        meterState.reading || localStorage.getItem(`meter_${meter.ID}_reading`);
      const isConfirmed =
        meterState.isConfirmed ||
        localStorage.getItem(`meter_${meter.ID}_confirmed`) === "true";

      if (!reading || reading.trim() === "") {
        missingReadings.push(meter.ID);
      } else if (!isConfirmed) {
        unconfirmedReadings.push(meter.ID);
      }
    });

    // Build warning message if needed
    let warningMessage = "";
    if (missingReadings.length > 0) {
      warningMessage += `Faltan lecturas para los medidores: ${missingReadings.join(
        ", "
      )}\n\n`;
    }
    if (unconfirmedReadings.length > 0) {
      warningMessage += `Lecturas sin confirmar para los medidores: ${unconfirmedReadings.join(
        ", "
      )}\nLas lecturas sin confirmar serán descartadas.`;
    }

    // If there are warnings, show confirmation dialog
    if (warningMessage) {
      if (window.confirm(`${warningMessage}\n\n¿Desea continuar?`)) {
        // If user confirms, collect only confirmed readings
        const confirmedReadings = combinedMeters
          .map((meter) => {
            const meterState = readingsState[meter.ID] || {};
            const reading =
              meterState.reading ||
              localStorage.getItem(`meter_${meter.ID}_reading`);
            const isConfirmed =
              meterState.isConfirmed ||
              localStorage.getItem(`meter_${meter.ID}_confirmed`) === "true";

            if (reading && isConfirmed) {
              return {
                ID: meter.ID,
                reading: reading,
                address: meter.ADDRESS,
              };
            }
            return null;
          })
          .filter(Boolean); // Remove null entries

        setSubmittedReadings(confirmedReadings);
        setCurrentIndex(combinedMeters.length + 1);
      }
    } else {
      // If no warnings, proceed with all confirmed readings
      const confirmedReadings = combinedMeters
        .map((meter) => {
          const meterState = readingsState[meter.ID] || {};
          const reading =
            meterState.reading ||
            localStorage.getItem(`meter_${meter.ID}_reading`);
          const isConfirmed =
            meterState.isConfirmed ||
            localStorage.getItem(`meter_${meter.ID}_confirmed`) === "true";

          if (reading && isConfirmed) {
            return {
              ID: meter.ID,
              reading: reading,
              address: meter.ADDRESS,
            };
          }
          return null;
        })
        .filter(Boolean);

      setSubmittedReadings(confirmedReadings);
      setCurrentIndex(combinedMeters.length + 1);
    }

    // Subir archivo a Cloud Storage
    const fileName = `${selectedRoute}_${
      new Date().toISOString().split("T")[0]
    }.json`;
    const storageRef = ref(storage, `readings/${fileName}`);
    const readingsBlob = new Blob([JSON.stringify(submittedReadings)], {
      type: "application/json",
    });

    await uploadBytes(storageRef, readingsBlob);

    // Actualizar metadatos en Firestore
    const routeRef = doc(db, "routes", selectedRoute);
    await setDoc(
      routeRef,
      {
        latestFile: fileName,
        lastUpdated: new Date().toISOString(),
      },
      { merge: true }
    );
  };

  // Handler for reading changes
  const handleReadingChange = useCallback((meterId, reading) => {
    setReadingsState((prev) => ({
      ...prev,
      [meterId]: { ...prev[meterId], reading },
    }));
  }, []);

  // Handler for confirmation changes
  const handleConfirmationChange = useCallback((meterId, isConfirmed) => {
    setReadingsState((prev) => ({
      ...prev,
      [meterId]: { ...prev[meterId], isConfirmed },
    }));
  }, []);

  // Only one home screen branch (when currentIndex is null)
  if (currentIndex === null) {
    // Determine if any meter has a non-empty reading from localStorage
    const hasReadings = combinedMeters.some((meter) => {
      const r = localStorage.getItem(`meter_${meter.ID}_reading`);
      return r && r.trim() !== "";
    });

    // Find the index of the first meter missing a reading
    const nextIncompleteIndex = combinedMeters.findIndex((meter) => {
      const r = localStorage.getItem(`meter_${meter.ID}_reading`);
      return !r || r.trim() === "";
    });

    const onContinue = () => {
      if (nextIncompleteIndex !== -1) {
        setCurrentIndex(nextIncompleteIndex);
      } else {
        // All meters have readings, go to final check
        setCurrentIndex(combinedMeters.length);
      }
    };

    const handleRestart = () => {
      setRestartDialogOpen(true);
    };

    const confirmRestart = () => {
      if (restartConfirmation === "REINICIAR") {
        combinedMeters.forEach((meter) => {
          localStorage.removeItem(`meter_${meter.ID}_reading`);
          localStorage.removeItem(`meter_${meter.ID}_confirmed`);
        });
        setReadingsState({});
        setCurrentIndex(0);
        setRestartDialogOpen(false);
        setRestartConfirmation("");
      }
    };

    const restartDialog = (
      <Dialog
        open={restartDialogOpen}
        onClose={() => {
          setRestartDialogOpen(false);
          setRestartConfirmation("");
        }}
      >
        <DialogTitle sx={{ color: "error.main" }}>
          ⚠️ Advertencia: Acción Destructiva
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>
            Está a punto de eliminar TODAS las lecturas de medidores. Esta
            acción no se puede deshacer.
          </Typography>
          <Typography sx={{ mb: 2, fontWeight: "bold" }}>
            Escriba "REINICIAR" para confirmar:
          </Typography>
          <TextField
            fullWidth
            value={restartConfirmation}
            onChange={(e) => setRestartConfirmation(e.target.value)}
            error={
              restartConfirmation !== "" && restartConfirmation !== "REINICIAR"
            }
            helperText={
              restartConfirmation !== "" && restartConfirmation !== "REINICIAR"
                ? 'Debe escribir "REINICIAR" exactamente'
                : ""
            }
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setRestartDialogOpen(false);
              setRestartConfirmation("");
            }}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="error"
            disabled={restartConfirmation !== "REINICIAR"}
            onClick={confirmRestart}
          >
            Confirmar Reinicio
          </Button>
        </DialogActions>
      </Dialog>
    );

    return (
      <>
        <Layout
          showSidebar={false}
          meters={combinedMeters}
          currentIndex={-1}
          onSelectMeter={() => {}}
          onHomeClick={handleHomeClick}
          onFinishClick={handleFinishClick}
          readingsState={readingsState}
        >
          <HomeScreen
            hasReadings={hasReadings}
            onStart={() => setCurrentIndex(0)}
            onContinue={onContinue}
            onRestart={handleRestart}
            routes={availableRoutes}
            onRouteSelect={(route) => setSelectedRoute(route)}
          />
        </Layout>
        {restartDialog}
      </>
    );
  } else if (currentIndex >= 0 && currentIndex < combinedMeters.length) {
    // Meter screens
    return (
      <Layout
        showSidebar={true}
        meters={combinedMeters}
        currentIndex={currentIndex}
        onSelectMeter={(i) => setCurrentIndex(i)}
        onHomeClick={handleHomeClick}
        onFinishClick={handleFinishClick}
        readingsState={readingsState}
      >
        <MeterScreen
          meter={combinedMeters[currentIndex]}
          currentIndex={currentIndex}
          totalMeters={combinedMeters.length}
          onHome={handleHomeClick}
          onPrev={() => setCurrentIndex((prev) => prev - 1)}
          onNext={() => setCurrentIndex((prev) => prev + 1)}
          onFinish={handleFinishClick}
          onReadingChange={handleReadingChange}
          onConfirmationChange={handleConfirmationChange}
        />
      </Layout>
    );
  } else if (currentIndex === combinedMeters.length) {
    // Final check screen
    return (
      <Layout
        showSidebar={false}
        meters={combinedMeters}
        currentIndex={currentIndex}
        onSelectMeter={() => {}}
        onHomeClick={handleHomeClick}
        onFinishClick={handleFinishClick}
        readingsState={readingsState}
      >
        <FinalCheckScreen
          onGoBack={() => setCurrentIndex(combinedMeters.length - 1)}
          onFinish={() => setCurrentIndex(combinedMeters.length + 1)}
        />
      </Layout>
    );
  } else if (currentIndex === combinedMeters.length + 1) {
    // Summary screen
    return (
      <Layout
        showSidebar={false}
        meters={combinedMeters}
        currentIndex={currentIndex}
        onSelectMeter={() => {}}
        onHomeClick={handleHomeClick}
        onFinishClick={handleFinishClick}
        readingsState={readingsState}
      >
        <SummaryScreen
          combinedMeters={combinedMeters}
          submittedReadings={submittedReadings}
          onSelectMeter={(index) => {
            setCurrentIndex(index); // Navigate to the selected meter
          }}
        />
      </Layout>
    );
  } else {
    return <div>Estado Inválido</div>;
  }
}

export default App;

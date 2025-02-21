// App.jsx
import React, { useState } from "react";
import Layout from "./Layout";
import HomeScreen from "./HomeScreen";
import MeterScreen from "./MeterScreen";
import FinalCheckScreen from "./FinalCheckScreen";
import SummaryScreen from "./SummaryScreen";
import routeData from "./data/route.json";
import readingsData from "./data/readings.json";

// Merge route + reading data
const combinedMeters = routeData.map((meter) => {
  const matchingReading = readingsData.find((r) => r.ID === meter.ID);
  return { ...meter, readings: matchingReading || {} };
});

function App() {
  const [currentIndex, setCurrentIndex] = useState(null);
  const [submittedReadings, setSubmittedReadings] = useState([]);

  const handleHomeClick = () => {
    setCurrentIndex(null);
  };

  const handleFinishClick = () => {
    // Go directly to summary
    setCurrentIndex(combinedMeters.length + 1);
  };

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
      combinedMeters.forEach((meter) => {
        localStorage.removeItem(`meter_${meter.ID}_reading`);
        localStorage.removeItem(`meter_${meter.ID}_confirmed`);
      });
      setCurrentIndex(0);
    };

    return (
      <Layout
        showSidebar={false}
        meters={combinedMeters}
        currentIndex={-1}
        onSelectMeter={() => {}}
        onHomeClick={handleHomeClick}
        onFinishClick={handleFinishClick}
      >
        <HomeScreen
          hasReadings={hasReadings}
          onStart={() => setCurrentIndex(0)}
          onContinue={onContinue}
          onRestart={handleRestart}
        />
      </Layout>
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
      >
        <MeterScreen
          meter={combinedMeters[currentIndex]}
          currentIndex={currentIndex}
          totalMeters={combinedMeters.length}
          onHome={handleHomeClick}
          onPrev={() => setCurrentIndex((prev) => prev - 1)}
          onNext={() => setCurrentIndex((prev) => prev + 1)}
          onFinish={handleFinishClick}
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
      >
        <SummaryScreen
          combinedMeters={combinedMeters}
          submittedReadings={submittedReadings}
        />
      </Layout>
    );
  } else {
    return <div>Invalid State</div>;
  }
}

export default App;

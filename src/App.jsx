// src/App.jsx
import React, { useState } from 'react';
import Layout from './Layout';
import HomeScreen from './HomeScreen';
import MeterScreen from './MeterScreen';
import FinalCheckScreen from './FinalCheckScreen';
import SummaryScreen from './SummaryScreen';
import routeData from './data/route.json';
import readingsData from './data/readings.json';

// Merge route and reading data
const combinedMeters = routeData.map((meter) => {
  const matchingReading = readingsData.find((r) => r.ID === meter.ID);
  return { ...meter, readings: matchingReading || {} };
});

function App() {
  // For example, null => Home, 0..n-1 => meter screens, n => final check, n+1 => summary
  const [currentIndex, setCurrentIndex] = useState(null);
  const [pendingReadings, setPendingReadings] = useState({});
  const [submittedReadings, setSubmittedReadings] = useState([]);

  // Handler for user clicking a meter in the sidebar
  const handleSelectMeter = (index) => {
    setCurrentIndex(index);
  };

  // Decide what to render based on currentIndex
  if (currentIndex === null) {
    // If you do NOT want the sidebar on the home screen, just return <HomeScreen> here
    return (
      <HomeScreen onStart={() => setCurrentIndex(0)} />
    );
  }

  // If you DO want the sidebar visible on the home screen as well, you can do:
  // return (
  //   <Layout
  //     meters={combinedMeters}
  //     currentIndex={currentIndex}
  //     onSelectMeter={handleSelectMeter}
  //   >
  //     <HomeScreen onStart={() => setCurrentIndex(0)} />
  //   </Layout>
  // );

  // Otherwise, for meter screens and beyond, wrap with Layout
  return (
    <Layout
      meters={combinedMeters}
      currentIndex={currentIndex}
      onSelectMeter={handleSelectMeter}
    >
      {currentIndex >= 0 && currentIndex < combinedMeters.length ? (
        <MeterScreen
          meter={combinedMeters[currentIndex]}
          currentIndex={currentIndex}
          totalMeters={combinedMeters.length}
          pendingReading={pendingReadings[combinedMeters[currentIndex].ID] || ''}
          onReadingChange={(e) => {
            setPendingReadings((prev) => ({
              ...prev,
              [combinedMeters[currentIndex].ID]: e.target.value,
            }));
          }}
          onSubmit={() => {
            // handle submission logic...
          }}
          onPrev={() => {
            if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
          }}
        />
      ) : currentIndex === combinedMeters.length ? (
        <FinalCheckScreen
          // your props here...
          onGoBack={() => setCurrentIndex(combinedMeters.length - 1)}
          onFinish={() => setCurrentIndex(combinedMeters.length + 1)}
        />
      ) : currentIndex === combinedMeters.length + 1 ? (
        <SummaryScreen
          // your props here...
        />
      ) : (
        <div>Invalid State</div>
      )}
    </Layout>
  );
}

export default App;

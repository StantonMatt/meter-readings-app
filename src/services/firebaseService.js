/**
 * Firebase service functions for the app
 */
import { collection, getDocs, doc, setDoc, getDoc, query, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { getPreviousMonthYear } from "../utils/dateUtils";
import { generateCSV } from "../utils/readingUtils";

/**
 * Load previous readings from Firestore
 * @param {Array} routeData - Route data containing meters
 * @param {number} selectedYear - Selected year
 * @param {number} selectedMonth - Selected month
 * @param {Object} db - Firestore database instance
 * @param {Array} months - Array of month names
 * @returns {Promise<Array>} Array of readings
 */
export const loadPreviousReadings = async (routeData, selectedYear, selectedMonth, db, months) => {
  try {
    const startDate = getPreviousMonthYear(selectedYear, selectedMonth);
    let currentYear = startDate.year;
    let currentMonth = startDate.month;
    const readings = [];

    // Initialize all meters with ID
    routeData.forEach((meter) => {
      readings.push({ ID: meter.ID });
    });

    // Try to load last 5 months of readings
    for (let i = 0; i < 5; i++) {
      const monthPrefix = `${currentYear}-${months[currentMonth]}`;
      const monthKey = monthPrefix;

      try {
        // Get all documents for this month
        const readingsRef = collection(db, "readings");
        const q = query(
          readingsRef,
          where("year", "==", currentYear),
          where("month", "==", months[currentMonth])
        );

        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          // Sort the documents in memory instead
          const docs = querySnapshot.docs;
          docs.sort(
            (a, b) =>
              b.data().timestamp.toMillis() - a.data().timestamp.toMillis()
          );

          // Use the most recent document
          const latestDoc = docs[0];
          const monthData = latestDoc.data().readings;

          // Transform the data to include the month
          monthData.forEach((reading) => {
            const existingReading = readings.find((r) => r.ID === reading.ID);
            if (existingReading) {
              existingReading[monthKey] = reading.Reading;
            }
          });
        } else {
          // If no readings found for this month
          readings.forEach((reading) => {
            reading[monthKey] = "NO DATA";
          });
        }
      } catch (error) {
        console.log(`Failed to load readings for ${monthPrefix}:`, error);
        readings.forEach((reading) => {
          reading[monthKey] = "NO DATA";
        });
      }

      // Move to previous month
      const prev = getPreviousMonthYear(currentYear, currentMonth);
      currentYear = prev.year;
      currentMonth = prev.month;
    }

    return readings;
  } catch (error) {
    console.error("Error in loadPreviousReadings:", error);
    throw error;
  }
};

/**
 * Initialize route data in Firestore
 * @param {Object} auth - Firebase auth instance
 * @param {Object} db - Firestore database instance
 * @param {Array} routeData - Route data to initialize
 * @param {Array} months - Array of month names
 * @returns {Promise<void>}
 */
export const initializeRouteData = async (auth, db, routeData, months, appCheckInitialized) => {
  try {
    // Wait for App Check token and verify auth
    const isInitialized = await appCheckInitialized;
    if (!isInitialized) {
      throw new Error("App Check initialization failed");
    }
    
    if (!auth.currentUser) {
      throw new Error("User not authenticated");
    }

    // Initialize route
    const routeId = "San_Lorenzo-Portal_Primavera";
    const routeRef = doc(db, "routes", routeId);

    const routeInfo = {
      name: routeId.replace(/_/g, " "),
      id: routeId,
      totalMeters: routeData.length,
      lastUpdated: new Date(),
      meters: routeData,
    };

    await setDoc(routeRef, routeInfo, { merge: true });
    console.log("Route data updated successfully");

    // Initialize readings
    const readingsCollectionRef = collection(db, "readings");
    const readingsContext = import.meta.glob("./data/readings/*.json");

    console.log("Found files:", Object.keys(readingsContext));

    for (const path in readingsContext) {
      try {
        const module = await readingsContext[path]();
        const readingsData = module.default;

        // Get exact filename without extension
        const fileName = path.split("/").pop().replace(".json", "");

        // Extract year and month from filename (e.g., "2024-09-00T00-00-00-000")
        const [year, month] = fileName.split("-");

        const readingDocRef = doc(readingsCollectionRef, fileName);

        await setDoc(
          readingDocRef,
          {
            readings: readingsData,
            routeId: routeId,
            month: months[parseInt(month) - 1], // Convert month number to name
            year: parseInt(year),
            timestamp: new Date(),
          },
          { merge: true }
        );

        console.log(`Successfully initialized readings for ${fileName}`);
      } catch (error) {
        console.error(`Failed to process file ${path}:`, error);
      }
    }

    // Initialize email config if needed
    const emailConfigRef = doc(db, "config", "email");
    const emailConfigDoc = await getDoc(emailConfigRef);

    if (!emailConfigDoc.exists()) {
      await setDoc(emailConfigRef, {
        recipients: ["stantonmatthewj@gmail.com", "matthew@temuco.com"],
      });
      console.log("Email config initialized");
    }

    console.log("All data initialized successfully");
    return true;
  } catch (error) {
    console.error("Detailed initialization error:", error);
    throw error;
  }
};

/**
 * Upload readings to Firestore and send email notification
 * @param {Array} combinedMeters - Array of meter objects
 * @param {Object} readingsState - Current state of readings
 * @param {Object} selectedRoute - Selected route
 * @param {number} selectedMonth - Selected month
 * @param {number} selectedYear - Selected year
 * @param {Object} db - Firestore database instance
 * @param {Object} functions - Firebase functions instance
 * @param {Array} months - Array of month names
 * @param {boolean} appCheckInitialized - App check status
 * @param {Object} auth - Firebase auth instance
 * @returns {Promise<Array>} Array of uploaded readings
 */
export const uploadReadings = async (
  combinedMeters, 
  readingsState, 
  selectedRoute, 
  selectedMonth, 
  selectedYear,
  db,
  functions,
  months,
  appCheckInitialized,
  auth
) => {
  try {
    // Wait for App Check token
    const isInitialized = await appCheckInitialized;
    if (!isInitialized) {
      throw new Error("App Check initialization failed");
    }

    // Verify user is authenticated
    if (!auth.currentUser) {
      throw new Error("User not authenticated");
    }

    // Generate standardized timestamp format: YYYY-MM-DDThh-mm-ss-SSS
    const now = new Date();
    const timestamp = now
      .toISOString()
      .replace(/[:.]/g, "-")
      .replace("Z", "");

    // Create standardized filename format
    const fileName = timestamp;

    // Collect all verification data
    const verifications = combinedMeters.reduce((acc, meter) => {
      const verificationKey = "meter_" + meter.ID + "_verification";
      const verificationRaw = localStorage.getItem(verificationKey);
      if (verificationRaw) {
        try {
          const verification = JSON.parse(verificationRaw);
          if (verification) {
            acc.push({
              meterId: meter.ID,
              address: meter.ADDRESS,
              ...verification,
            });
          }
        } catch (error) {
          console.error(
            "Error parsing verification data for meter " + meter.ID + ":",
            error
          );
        }
      }
      return acc;
    }, []);

    // Generate the readings data
    const readingsToUpload = combinedMeters.map((meter) => {
      const reading = readingsState[meter.ID];
      const verification = verifications.find((v) => v.meterId === meter.ID);

      return {
        ID: meter.ID,
        Reading: reading?.reading || "---",
        verification: verification || null,
      };
    });

    // Create the readings document with metadata
    const readingsInfo = {
      readings: readingsToUpload,
      timestamp: now,
      routeId: selectedRoute?.id || "San_Lorenzo-Portal_Primavera",
      month: months[selectedMonth],
      year: parseInt(selectedYear),
      verifications: verifications,
    };

    // Upload to Firestore
    const readingsRef = doc(db, "readings", fileName);
    await setDoc(readingsRef, readingsInfo);

    // Generate and download CSV file
    const csvContent = generateCSV(
      combinedMeters,
      months[selectedMonth],
      selectedYear,
      readingsState
    );

    // Generate email content
    let emailContent = combinedMeters
      .filter((meter) => {
        const reading = readingsState[meter.ID]?.reading;
        const isConfirmed = readingsState[meter.ID]?.isConfirmed;
        const verificationKey = "meter_" + meter.ID + "_verification";
        const verificationRaw = localStorage.getItem(verificationKey);
        let verificationData = null;

        try {
          verificationData = verificationRaw
            ? JSON.parse(verificationRaw)
            : null;
        } catch (error) {
          console.error(
            "Error parsing verification for meter " + meter.ID + ":",
            error
          );
        }

        return reading && isConfirmed && verificationData;
      })
      .map((meter) => {
        const reading = readingsState[meter.ID]?.reading;
        const sortedReadings = Object.entries(meter.readings)
          .filter(([k]) => k !== "ID")
          .sort((a, b) => b[0].localeCompare(a[0]));
        const lastReading = sortedReadings[0]?.[1] || "---";
        const consumption =
          reading !== "---" && lastReading !== "---"
            ? Number(reading) - Number(lastReading)
            : "---";

        const verificationKey = "meter_" + meter.ID + "_verification";
        const verificationData = JSON.parse(
          localStorage.getItem(verificationKey) || "null"
        );

        let meterInfo = [
          "CLIENTE: " + meter.ID,
          "DIRECCIÓN: " + meter.ADDRESS,
          "LECTURA ANTERIOR: " + lastReading,
          "LECTURA ACTUAL: " + reading,
          "CONSUMO: " + consumption + " m³",
        ].join("\n");

        if (verificationData?.type === "lowConsumption") {
          meterInfo += "\n\nNOTA DE VERIFICACIÓN:";
          if (verificationData.details.answeredDoor) {
            meterInfo += [
              "\n• Atendió el cliente: Sí",
              "\n• Reportó problemas con el agua: " +
                (verificationData.details.hadIssues ? "Sí" : "No"),
              "\n• Tiempo viviendo en la casa: " +
                verificationData.details.residenceMonths +
                " meses",
            ].join("");
          } else {
            meterInfo += [
              "\n• Atendió el cliente: No",
              "\n• Casa parece habitada: " +
                (verificationData.details.looksLivedIn ? "Sí" : "No"),
            ].join("");
          }
        }

        return meterInfo;
      })
      .join("\n----------------------------------------\n");

    // Call the cloud function
    const sendReadingsMail = httpsCallable(functions, "sendReadingsMail");
    await sendReadingsMail({
      readings: readingsToUpload,
      routeId: selectedRoute?.id || "San_Lorenzo-Portal_Primavera",
      month: months[selectedMonth],
      year: selectedYear,
      emailContent: emailContent,
    });
    
    return readingsToUpload;
  } catch (error) {
    console.error("Detailed error in uploadReadings:", error);
    throw error;
  }
};
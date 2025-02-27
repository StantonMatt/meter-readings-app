/**
 * Firebase service functions for the app
 */
import {
  collection,
  getDocs,
  doc,
  setDoc,
  getDoc,
  query,
  where,
  DocumentReference,
  Firestore,
  Query,
  QuerySnapshot,
  DocumentData,
  Timestamp,
  updateDoc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { httpsCallable, Functions } from "firebase/functions";
import { Auth } from "firebase/auth";
import { getPreviousMonthYear } from "../utils/dateUtils";
import {
  generateCSV,
  MeterData,
  ReadingsState,
  Reading,
} from "../utils/readingUtils";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db } from "../firebase-config";

// REMOVE ALL MOCK DATA - Delete these sections entirely
// No more mockReadingsData or any other hard-coded data

interface Verification {
  meterId: string;
  address: string;
  type: string;
  timestamp: string;
  [key: string]: any;
}

interface ReadingToUpload {
  ID: string | number;
  Reading: string;
  verification: Verification | null;
}

interface RouteData {
  id: string;
  name: string;
  meters: any[];
  totalMeters: number;
  lastUpdated?: Timestamp;
}

interface ReadingData {
  ID: string;
  ADDRESS: string;
  reading: string;
  timestamp: Timestamp;
  photoURL?: string;
  notes?: string;
  user?: string;
  routeId?: string;
  month?: string;
  year?: string;
}

// Add this at the top level of the file (outside any function)
const readingsCache: { [key: string]: any } = {};

/**
 * Get reading data directly from Firebase or fall back to empty arrays
 * This function should remain to load previous readings from Firestore
 */
export const loadPreviousReadings = async (): Promise<{
  readings: any[];
  success: boolean;
  error?: any;
}> => {
  try {
    console.log("Loading reading data from Firebase...");

    const readingsCollection = collection(db, "readings");
    const querySnapshot = await getDocs(readingsCollection);

    if (querySnapshot.empty) {
      console.log("No previous readings found in Firebase");
      return { readings: [], success: true };
    }

    const readings = querySnapshot.docs.map((doc) => {
      return { id: doc.id, ...doc.data() };
    });

    console.log("Successfully loaded reading data from Firebase");
    return { readings, success: true };
  } catch (error) {
    console.error("Error loading reading data:", error);
    return { readings: [], success: false, error };
  }
};

// Keep legitimate functions that work with Firebase

export const uploadPhoto = async (
  photo: File,
  meterId: string
): Promise<string> => {
  try {
    const storage = getStorage();
    const timestamp = new Date().getTime();
    const fileName = `meter_photos/${meterId}_${timestamp}.jpg`;
    const storageRef = ref(storage, fileName);

    await uploadBytes(storageRef, photo);
    const downloadURL = await getDownloadURL(storageRef);

    return downloadURL;
  } catch (error) {
    console.error("Error uploading photo:", error);
    throw error;
  }
};

/**
 * Initialize Firebase with data from local files
 * This is our consolidated initialization function that combines the functionality
 * from both initializeFirebaseWithLocalData and initializeFirebaseData
 */
export const initializeFirebaseData = async (
  auth: Auth,
  db: Firestore,
  appCheckInitialized: Promise<boolean>
): Promise<{ success: boolean; message: string }> => {
  try {
    // Wait for App Check initialization
    const isInitialized = await appCheckInitialized;
    if (!isInitialized) {
      throw new Error("App Check initialization failed");
    }

    // Verify user is authenticated
    if (!auth.currentUser) {
      throw new Error("User not authenticated");
    }

    console.log("Starting Firebase initialization...");

    // Define month names (using lowercase for consistency)
    const monthNames = [
      "enero",
      "febrero",
      "marzo",
      "abril",
      "mayo",
      "junio",
      "julio",
      "agosto",
      "septiembre",
      "octubre",
      "noviembre",
      "diciembre",
    ];

    // Use Vite's glob import to load files dynamically
    const readingFiles = import.meta.glob(
      "../data/routes/sl-pp/readings/*.json",
      { eager: false }
    );

    console.log(`Found ${Object.keys(readingFiles).length} reading files`);

    // Import route data directly, no mock data
    const routeData = (await import("../data/routes/sl-pp/ruta_sl-pp.json"))
      .default;

    // Process reading files to build a map of readings by meter ID
    const meterReadingsMap = new Map();
    const processedFiles = [];

    // Process each reading file
    for (const path in readingFiles) {
      try {
        // Extract month and year from filename
        const filename = path.split("/").pop()?.replace(".json", "") || "";
        if (!filename) continue;

        // Parse the filename to extract year and month
        let year, month;

        if (filename.includes("T")) {
          // Format: YYYY-MM-00T00-00-00-000
          const parts = filename.split("-");
          if (parts.length >= 2) {
            year = parts[0];
            month = parts[1];
          } else {
            console.warn(`Invalid filename format: ${filename}, skipping`);
            continue;
          }
        } else {
          // Format: YYYY-MM
          [year, month] = filename.split("-");
        }

        if (!year || !month) {
          console.warn(
            `Couldn't extract year/month from: ${filename}, skipping`
          );
          continue;
        }

        // Get month name
        const monthIndex = parseInt(month) - 1;
        if (monthIndex < 0 || monthIndex >= 12) {
          console.warn(
            `Invalid month index: ${monthIndex}, skipping file ${filename}`
          );
          continue;
        }

        const monthName = monthNames[monthIndex];

        // Import the file and get its data
        const module = await readingFiles[path]();
        const readingData = (module as any).default;

        // Format for key in the readings object: year-monthname (lowercase)
        const readingKey = `${year}-${monthName}`;

        // Process each reading and add to the map
        if (Array.isArray(readingData)) {
          readingData.forEach((reading) => {
            if (reading.ID) {
              const meterId = reading.ID.toString();
              if (!meterReadingsMap.has(meterId)) {
                meterReadingsMap.set(meterId, {});
              }

              // Add reading to the meter's readings object (ensure it's a number)
              const meterReadings = meterReadingsMap.get(meterId);
              const readingValue = reading.Reading || reading.reading;
              meterReadings[readingKey] =
                typeof readingValue === "string"
                  ? parseInt(readingValue, 10)
                  : readingValue;
            }
          });
        }

        processedFiles.push({
          path,
          month: monthName,
          year,
          count: Array.isArray(readingData) ? readingData.length : 0,
        });
      } catch (err) {
        console.error(`Error processing file ${path}:`, err);
      }
    }

    // Enhance route data with the readings
    const enhancedMeterData = routeData.map((meter) => {
      const meterId = meter.ID.toString();
      const readings = meterReadingsMap.get(meterId) || {};

      // Extract readings for consumption calculation
      const readingsByDate = Object.entries(readings)
        .map(([key, value]) => ({
          date: key,
          value: typeof value === "number" ? value : parseFloat(String(value)),
        }))
        .filter((item) => !isNaN(item.value));

      // Sort readings by date
      readingsByDate.sort((a, b) => b.date.localeCompare(a.date));

      // Calculate monthly consumption (difference between consecutive readings)
      const consumption = [];
      for (let i = 0; i < readingsByDate.length - 1; i++) {
        const diff = readingsByDate[i].value - readingsByDate[i + 1].value;
        if (diff >= 0) {
          consumption.push(diff);
        }
      }

      // Ensure consumption is an array
      const monthlyConsumption = consumption.length > 0 ? consumption : [0];

      // Calculate average consumption
      const averageConsumption =
        consumption.length > 0
          ? consumption.reduce((sum, val) => sum + val, 0) / consumption.length
          : 0;

      return {
        ...meter,
        readings, // Direct use of readings object
        monthlyConsumption,
        averageConsumption,
        estimatedReading: 0,
        monthsEstimated: 0,
      };
    });

    // Route ID and name
    const routeId = "sl-pp";
    const routeName = "San Lorenzo-Portal Primavera";

    // Create the route document with enhanced meter data
    const routeRef = doc(db, "routes", routeId);
    await setDoc(routeRef, {
      id: routeId,
      name: routeName,
      meters: enhancedMeterData,
      totalMeters: enhancedMeterData.length,
      lastUpdated: serverTimestamp(),
    });

    console.log("Route document created");

    // Also create the reading documents in the subcollection for reference
    const batch = writeBatch(db);

    for (const processedFile of processedFiles) {
      const { month, year, path } = processedFile;
      const module = await readingFiles[path]();
      const readingData = (module as any).default;

      // Use the original filename as the document ID for clarity
      const filename = path.split("/").pop()?.replace(".json", "") || "";
      const readingRef = doc(db, "routes", routeId, "readings", filename);

      // Store original reading file data
      batch.set(readingRef, {
        readings: readingData,
        timestamp: serverTimestamp(),
        month,
        year: parseInt(year),
      });
    }

    await batch.commit();

    console.log(
      `Processed ${processedFiles.length} reading files, created ${enhancedMeterData.length} meters`
    );

    return {
      success: true,
      message: `Firebase initialization complete. Processed ${processedFiles.length} reading files and enhanced ${enhancedMeterData.length} meters.`,
    };
  } catch (error) {
    console.error("Error initializing Firebase data:", error);
    return {
      success: false,
      message: `Error: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    };
  }
};

/**
 * Load previous readings for a meter
 */
export const getPreviousReadings = async (
  meterId: string,
  routeId: string | null
) => {
  if (!routeId) {
    console.error("No route ID provided for previous readings");
    return null;
  }

  // Create a cache key
  const cacheKey = `${routeId}_${meterId}`;

  // Clear the cache for this meter to ensure fresh data
  delete readingsCache[cacheKey];

  try {
    console.log(
      `Getting previous readings for meter ${meterId} in route ${routeId}`
    );

    // Fetch the route document
    const routeRef = doc(db, "routes", routeId);
    const routeDoc = await getDoc(routeRef);

    if (!routeDoc.exists()) {
      console.warn(`Route ${routeId} not found`);
      return null;
    }

    const routeData = routeDoc.data();
    const meters = routeData.meters || [];

    // Find the meter with this ID
    const meter = meters.find((m: any) => String(m.ID) === String(meterId));

    if (!meter) {
      console.warn(`Meter ${meterId} not found in route ${routeId}`);
      return null;
    }

    let result;

    if (meter.readings && Object.keys(meter.readings).length > 0) {
      // Extract entries for convenience, but don't filter them here
      // The filtering will happen in the component
      const entries = Object.entries(meter.readings)
        .map(([key, value]) => ({
          date: key,
          value: typeof value === "number" ? value : parseFloat(String(value)),
        }))
        .filter((entry) => !isNaN(entry.value));

      // Sort by date (newest first)
      entries.sort((a, b) => b.date.localeCompare(a.date));

      result = {
        ...meter,
        entries,
      };
    } else {
      result = {
        ...meter,
        entries: [],
      };
    }

    // Cache the result for future use
    readingsCache[cacheKey] = result;

    return result;
  } catch (error) {
    console.error(
      `Error getting previous readings for meter ${meterId}:`,
      error
    );
    return null;
  }
};

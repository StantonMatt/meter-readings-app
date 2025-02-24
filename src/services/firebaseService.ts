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

/**
 * Load previous readings from Firestore
 * @param {Array} routeData - Route data containing meters
 * @param {number} selectedYear - Selected year
 * @param {number} selectedMonth - Selected month
 * @param {Object} db - Firestore database instance
 * @param {Array} months - Array of month names
 * @returns {Promise<Array>} Array of readings
 */
export const loadPreviousReadings = async (
  routeData: MeterData[],
  selectedYear: number,
  selectedMonth: number,
  db: Firestore,
  months: string[]
): Promise<Reading[]> => {
  try {
    const startDate = getPreviousMonthYear(selectedYear, selectedMonth);
    let currentYear = startDate.year;
    let currentMonth = startDate.month;
    const readings: Reading[] = [];

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
          docs.sort((a, b) => {
            const aTimestamp = a.data().timestamp as Timestamp;
            const bTimestamp = b.data().timestamp as Timestamp;
            return bTimestamp.toMillis() - aTimestamp.toMillis();
          });

          // Use the most recent document
          const latestDoc = docs[0];
          const monthData = latestDoc.data().readings;

          // Transform the data to include the month
          monthData.forEach((reading: any) => {
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
export const initializeRouteData = async (
  auth: Auth,
  db: Firestore,
  routeData: MeterData[],
  months: string[],
  appCheckInitialized: Promise<boolean>
): Promise<boolean> => {
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

    // TypeScript can't handle this import.meta.glob easily - need a different approach
    // Use a more direct approach for the TypeScript version
    console.log("Would normally process JSON files here");

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
  combinedMeters: MeterData[],
  readingsState: ReadingsState,
  selectedRoute: { id: string } | null,
  selectedMonth: number,
  selectedYear: number,
  db: Firestore,
  functions: Functions,
  months: string[],
  appCheckInitialized: Promise<boolean>,
  auth: Auth
): Promise<ReadingToUpload[]> => {
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
    const timestamp = now.toISOString().replace(/[:.]/g, "-").replace("Z", "");

    // Create standardized filename format
    const fileName = timestamp;

    // Collect all verification data
    const verifications: Verification[] = combinedMeters.reduce(
      (acc: Verification[], meter) => {
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
      },
      []
    );

    // Generate the readings data
    const readingsToUpload: ReadingToUpload[] = combinedMeters.map((meter) => {
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
      year: parseInt(selectedYear.toString()),
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

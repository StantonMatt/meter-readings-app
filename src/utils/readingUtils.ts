/**
 * Utilities for processing meter readings
 */
import { monthOrder } from "./dateUtils";

export interface Reading {
  ID: string | number;
  ADDRESS?: string;
  [key: string]: any;
}

export interface MeterData {
  ID: string | number;
  ADDRESS: string;
  readings: Record<string, any>;
  monthlyConsumption: number[];
  averageConsumption: number;
  estimatedReading: number | null;
  monthsEstimated: number;
}

export interface ReadingState {
  reading: string;
  isConfirmed: boolean;
}

export interface ReadingsState {
  [meterId: string]: {
    reading?: string;
    isConfirmed?: boolean;
    photoURL?: string;
    notes?: string;
  };
}

export interface ConsumptionStats {
  monthlyConsumption: number[];
  averageConsumption: number;
  estimatedReading: number | null;
  monthsEstimated: number;
}

interface ReadingEntry {
  date: string;
  value: number | null;
}

/**
 * Calculate monthly consumption from historical readings
 * @param {Object} readings - Object containing reading history
 * @returns {Object} Object containing consumption statistics
 */
export const calculateMonthlyConsumption = (
  readings: Reading
): ConsumptionStats => {
  // Get all readings except ID and ADDRESS, convert to array of [date, value] pairs
  const readingsArray: ReadingEntry[] = Object.entries(readings)
    .filter(([key]) => key !== "ID" && key !== "ADDRESS")
    .map(([date, value]) => ({
      date,
      value:
        value === "---" || value === "NO DATA"
          ? null
          : parseFloat(value as string),
    }))
    .sort((a, b) => {
      const [yearA, monthA] = a.date.split("-");
      const [yearB, monthB] = b.date.split("-");
      const yearDiff = parseInt(yearB) - parseInt(yearA);
      if (yearDiff !== 0) return yearDiff;
      return monthOrder[monthB] - monthOrder[monthA];
    });

  const consumption: number[] = [];
  for (let i = 0; i < readingsArray.length - 1; i++) {
    const current = readingsArray[i].value;
    const previous = readingsArray[i + 1].value;
    if (current !== null && previous !== null) {
      const monthlyUsage = current - previous;
      if (monthlyUsage >= 0) {
        consumption.push(monthlyUsage);
      }
    }
  }

  const recentConsumption = consumption.slice(0, 5);
  const average =
    recentConsumption.length > 0
      ? recentConsumption.reduce((sum, value) => sum + value, 0) /
        recentConsumption.length
      : 0;

  let estimatedReading: number | null = null;
  let monthsToEstimate = 1;

  // Find the last valid reading
  for (const reading of readingsArray) {
    if (reading.value !== null) {
      estimatedReading = reading.value + average * monthsToEstimate;
      break;
    }
    monthsToEstimate++;
  }

  return {
    monthlyConsumption: consumption,
    averageConsumption: Math.round(average * 100) / 100,
    estimatedReading:
      estimatedReading !== null ? Math.round(estimatedReading) : null,
    monthsEstimated: monthsToEstimate,
  };
};

/**
 * Order readings by date in chronological order
 * @param {Object} readings - Object with readings by date
 * @returns {Object} Ordered readings object
 */
export const orderReadingsByDate = (readings: Reading): Reading => {
  return Object.entries(readings)
    .filter(([key]) => key !== "ID")
    .sort((a, b) => {
      // Parse dates like "2025-Enero" into comparable values
      const [yearA, monthA] = a[0].split("-");
      const [yearB, monthB] = b[0].split("-");

      // First compare years
      if (yearA !== yearB) {
        return parseInt(yearA) - parseInt(yearB);
      }

      // If years are the same, compare months
      return monthOrder[monthA] - monthOrder[monthB];
    })
    .reduce(
      (acc, [key, value]) => {
        acc[key] = value;
        return acc;
      },
      { ID: readings.ID } as Reading
    );
};

/**
 * Find the first meter that needs reading or confirmation
 * @param {Array} meters - Array of meter objects
 * @param {Object} readingsState - Current state of readings
 * @returns {number} Index of first pending meter
 */
export const findFirstPendingMeter = (
  meters: MeterData[],
  readingsState: ReadingsState
): number => {
  const index = meters.findIndex((meter) => {
    const state = readingsState[meter.ID];
    return !state || !state.isConfirmed; // Return true for unfilled or unconfirmed readings
  });
  return index === -1 ? 0 : index; // Return 0 if no pending meters found
};

/**
 * Generate CSV content for readings
 * @param {Array} meters - Array of meter objects
 * @param {string} month - Month name
 * @param {number} year - Year number
 * @param {Object} readingsState - Current state of readings
 * @returns {string} CSV content as string
 */
export const generateCSV = (
  meters: MeterData[],
  month: string,
  year: number,
  readingsState: ReadingsState
): string => {
  // Create CSV header
  const csvRows: string[] = [
    "ID,Direccion,Lectura Anterior,Lectura Actual,Estado\n",
  ];

  meters.forEach((meter) => {
    const reading = readingsState[meter.ID];
    const previousReadings = Object.entries(meter.readings)
      .filter(([k]) => k !== "ID")
      .sort((a, b) => b[0].localeCompare(a[0]));
    const lastMonthReading = previousReadings[0]?.[1] || "---";

    const status = reading?.isConfirmed
      ? "Confirmado"
      : reading?.reading
      ? "Sin Confirmar"
      : "Omitido";

    const currentReading = reading?.reading || "---";

    // Escape commas in address
    const escapedAddress = meter.ADDRESS.replace(/,/g, ";");

    csvRows.push(
      `${meter.ID},${escapedAddress},${lastMonthReading},${currentReading},${status}\n`
    );
  });

  return csvRows.join("");
};

/**
 * Debounce helper function to limit how often a function can be called
 * @param func The function to debounce
 * @param wait Wait time in milliseconds
 * @returns Debounced function
 */
export const debounce = <T extends (...args: any[]) => void>(
  func: T,
  wait: number
): T => {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  const debounced = function (this: any, ...args: Parameters<T>) {
    const context = this;

    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(() => {
      func.apply(context, args);
      timeout = null;
    }, wait);
  } as T;

  return debounced;
};

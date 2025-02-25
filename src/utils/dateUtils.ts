/**
 * Date and month utilities for the app
 */

// Spanish month names
export const months: string[] = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

// Month abbreviations
export const monthAbbreviations: Record<string, string> = {
  Enero: "Ene",
  Febrero: "Feb",
  Marzo: "Mar",
  Abril: "Abr",
  Mayo: "May",
  Junio: "Jun",
  Julio: "Jul",
  Agosto: "Ago",
  Septiembre: "Sep",
  Octubre: "Oct",
  Noviembre: "Nov",
  Diciembre: "Dic",
};

// Month order mapping for sorting
export const monthOrder: Record<string, number> = {
  Enero: 1,
  Febrero: 2,
  Marzo: 3,
  Abril: 4,
  Mayo: 5,
  Junio: 6,
  Julio: 7,
  Agosto: 8,
  Septiembre: 9,
  Octubre: 10,
  Noviembre: 11,
  Diciembre: 12,
};

/**
 * Get formatted month-year string (YYYY-mmm)
 * @param {Date} date - Date object
 * @returns {string} Formatted string like "2025-ene"
 */
export const getFormattedMonthYear = (date: Date): string => {
  const year = date.getFullYear();
  const month = months[date.getMonth()].substring(0, 3).toLowerCase();
  return `${year}-${month}`;
};

interface MonthYearPair {
  year: number;
  month: number;
}

/**
 * Get previous month and year
 * @param {number} year - Current year
 * @param {number} month - Current month (0-11)
 * @returns {Object} Object with previous year and month
 */
export const getPreviousMonthYear = (
  year: number,
  month: number
): MonthYearPair => {
  if (month === 0) {
    // If January, go to December of previous year
    return { year: year - 1, month: 11 };
  }
  return { year, month: month - 1 };
};

/**
 * Generate a filename for a given month and year
 * @param {number} year - Year number
 * @param {number} month - Month index (0-11)
 * @returns {string} Filename like "2025-Enero"
 */
export const getMonthFileName = (year: number, month: number): string => {
  const monthName = months[month];
  return `${year}-${monthName}`;
};

// Array of Spanish month names
export const monthNames = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

/**
 * Get the previous month and year based on current month and year
 */
export function getPreviousMonth(
  currentMonth: number,
  currentYear: number
): { month: number; year: number; name: string } {
  let prevMonth = currentMonth - 1;
  let prevYear = currentYear;

  if (prevMonth < 0) {
    prevMonth = 11; // December
    prevYear -= 1;
  }

  return {
    month: prevMonth,
    year: prevYear,
    name: monthNames[prevMonth],
  };
}

/**
 * Format a reading key in the format YYYY-Month
 */
export function formatReadingKey(year: number, monthName: string): string {
  return `${year}-${monthName}`;
}

/**
 * Find previous month's reading from a meter's readings object
 */
export function findPreviousMonthReading(
  readings: Record<string, any>,
  selectedMonth: number,
  selectedYear: number
): { key: string; reading: string | null } {
  // Get previous month info
  const prevMonth = getPreviousMonth(selectedMonth, selectedYear);

  // Create the key for previous month
  const key = formatReadingKey(prevMonth.year, prevMonth.name);

  // Look for the reading with this key
  if (readings && readings[key] !== undefined) {
    return { key, reading: readings[key] };
  }

  // If not found, return null reading
  return { key, reading: null };
}

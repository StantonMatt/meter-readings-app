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
export const getPreviousMonthYear = (year: number, month: number): MonthYearPair => {
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
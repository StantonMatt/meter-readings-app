/**
 * Date and month utilities for the app
 */

// Spanish month names
export const months = [
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
export const monthAbbreviations = {
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
export const monthOrder = {
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
export const getFormattedMonthYear = (date) => {
  const year = date.getFullYear();
  const month = months[date.getMonth()].substring(0, 3).toLowerCase();
  return `${year}-${month}`;
};

/**
 * Get previous month and year
 * @param {number} year - Current year
 * @param {number} month - Current month (0-11)
 * @returns {Object} Object with previous year and month
 */
export const getPreviousMonthYear = (year, month) => {
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
export const getMonthFileName = (year, month) => {
  const monthName = months[month];
  return `${year}-${monthName}`;
};
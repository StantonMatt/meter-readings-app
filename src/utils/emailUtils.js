/**
 * Utilities for generating email content
 */

/**
 * Generate email content from verification data
 * @param {Array} meters - Array of meter objects 
 * @param {Object} readingsState - Current state of readings
 * @returns {string} Formatted email content
 */
export const generateEmailContent = (meters, readingsState) => {
  return meters
    .filter((meter) => {
      const reading = readingsState[meter.ID]?.reading;
      const isConfirmed = readingsState[meter.ID]?.isConfirmed;
      const verificationRaw = localStorage.getItem(
        `meter_${meter.ID}_verification`
      );
      let verificationData = null;
      try {
        verificationData =
          verificationRaw &&
          verificationRaw.trim() !== "" &&
          verificationRaw.trim().toLowerCase() !== "null"
            ? JSON.parse(verificationRaw)
            : null;
      } catch (error) {
        verificationData = null;
      }
      // Only include if verificationData exists and is explicitly for lowConsumption
      return (
        reading &&
        isConfirmed &&
        verificationData &&
        verificationData.type === "lowConsumption"
      );
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

      const verificationData = JSON.parse(
        localStorage.getItem(`meter_${meter.ID}_verification`) || "null"
      );

      let meterInfo = `
CLIENTE: ${meter.ID}
DIRECCIÓN: ${meter.ADDRESS}
LECTURA ANTERIOR: ${lastReading}
LECTURA ACTUAL: ${reading}
CONSUMO: ${consumption} m³`;

      if (verificationData?.type === "lowConsumption") {
        meterInfo += `\n\nNOTA DE VERIFICACIÓN:`;
        if (verificationData.details.answeredDoor) {
          meterInfo += `
• Atendió el cliente: Sí
• Reportó problemas con el agua: ${
            verificationData.details.hadIssues ? "Sí" : "No"
          }
• Tiempo viviendo en la casa: ${
            verificationData.details.residenceMonths
          } meses`;
        } else {
          meterInfo += `
• Atendió el cliente: No
• Casa parece habitada: ${verificationData.details.looksLivedIn ? "Sí" : "No"}`;
        }
      }

      return meterInfo + "\n----------------------------------------";
    })
    .join("\n\n");
};
import React, { useEffect } from "react";

const mockReadings = [
  // Low Consumption Examples
  {
    ID: "1234",
    ADDRESS: "123 Test St",
    Reading: "150",
    verification: {
      type: "lowConsumption",
      consumption: 2,
      currentReading: "150",
      previousReading: "148",
      details: {
        answeredDoor: true,
        hadIssues: false,
        residenceMonths: "24",
      },
    },
  },
  {
    ID: "2345",
    ADDRESS: "234 Sample Ave",
    Reading: "85",
    verification: {
      type: "lowConsumption",
      consumption: 1,
      currentReading: "85",
      previousReading: "84",
      details: {
        answeredDoor: false,
        looksLivedIn: true,
      },
    },
  },
  {
    ID: "3456",
    ADDRESS: "345 Example Rd",
    Reading: "220",
    verification: {
      type: "lowConsumption",
      consumption: 3,
      currentReading: "220",
      previousReading: "217",
      details: {
        answeredDoor: true,
        hadIssues: true,
        residenceMonths: "8",
      },
    },
  },

  // Negative Consumption Examples
  {
    ID: "4567",
    ADDRESS: "456 Mock Ave",
    Reading: "80",
    verification: {
      type: "negativeConsumption",
      currentReading: 80,
      previousReading: 100,
      consumption: -20,
    },
  },
  {
    ID: "5678",
    ADDRESS: "567 Test Blvd asdfff asdfas asdf asdf",
    Reading: "150",
    verification: {
      type: "negativeConsumption",
      currentReading: 150,
      previousReading: 180,
      consumption: -30,
    },
  },
  {
    ID: "6789",
    ADDRESS: "678 Sample St",
    Reading: "95",
    verification: {
      type: "negativeConsumption",
      currentReading: 95,
      previousReading: 105,
      consumption: -10,
    },
  },

  // High Consumption Examples
  {
    ID: "7890",
    ADDRESS: "789 Example Ave",
    Reading: "200",
    verification: {
      type: "highConsumption",
      consumption: 50,
      currentReading: "200",
      previousReading: "150",
      average: 30,
      percentageAboveAverage: 66.7,
    },
  },
  {
    ID: "8901",
    ADDRESS: "890 Test Dr",
    Reading: "350",
    verification: {
      type: "highConsumption",
      consumption: 80,
      currentReading: "350",
      previousReading: "270",
      average: 45,
      percentageAboveAverage: 77.8,
    },
  },
  {
    ID: "9012",
    ADDRESS: "901 Sample Ct",
    Reading: "180",
    verification: {
      type: "highConsumption",
      consumption: 40,
      currentReading: "180",
      previousReading: "140",
      average: 25,
      percentageAboveAverage: 60.0,
    },
  },
];

function EmailPreviewTable() {
  useEffect(() => {
    const generateEmailHtml = () => {
      const totalMeters = mockReadings.length;
      const skippedMeters = mockReadings.filter(
        (r) => r.Reading === "---"
      ).length;
      const completedMeters = totalMeters - skippedMeters;

      const consumptionData = mockReadings
        .filter((r) => r.Reading !== "---")
        .map((r) => ({
          consumption: r.verification?.consumption || 10,
          current: Number(r.Reading),
          previous: Number(r.Reading) - (r.verification?.consumption || 10),
        }));

      const totalConsumption = consumptionData.reduce(
        (sum, r) => sum + r.consumption,
        0
      );
      const avgConsumption = Math.round(
        totalConsumption / consumptionData.length
      );
      const maxConsumption = Math.max(
        ...consumptionData.map((r) => r.consumption)
      );
      const minConsumption = Math.min(
        ...consumptionData.map((r) => r.consumption)
      );

      const verificationsByType = mockReadings.reduce((acc, reading) => {
        if (reading.verification) {
          const type = reading.verification.type;
          if (!acc[type]) acc[type] = [];
          acc[type].push(reading);
        }
        return acc;
      }, {});

      const logoUrl = "/coab_logo.png";

      const generateVerificationCard = (reading, type) => {
        const verification = reading.verification;
        const truncateAddress = (address, maxLength = 25) => {
          return address.length > maxLength
            ? address.substring(0, maxLength) + "..."
            : address;
        };

        return `
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:15px;background:#fff;border:1px solid #edf2f7;border-radius:4px;">
            <tr>
              <td style="padding:15px;">
                <div style="margin-bottom:8px;font-size:13px;"><strong>CLIENTE:</strong> ${
                  reading.ID
                }</div>
                <div style="margin-bottom:8px;font-size:13px;"><strong>DIRECCIÓN:</strong> ${truncateAddress(
                  reading.ADDRESS || ""
                )}</div>
                <div style="margin-bottom:8px;font-size:13px;"><strong>Lectura Anterior:</strong> ${
                  verification.previousReading || "---"
                }</div>
                <div style="margin-bottom:8px;font-size:13px;"><strong>Lectura Actual:</strong> ${
                  verification.currentReading || reading.Reading
                }</div>
                ${
                  type === "lowConsumption"
                    ? `
                  <div style="margin-bottom:8px;font-size:13px;"><strong>CONSUMO:</strong> ${
                    verification.consumption
                  } m³</div>
                  <div style="
                    margin-top:15px;
                    padding:15px;
                    background:#f8fafc;
                    border-left:3px solid #1c2c64;
                    font-size:12px;
                    line-height:1.5;
                    height:120px;
                    overflow-y:auto;
                  ">
                    <strong style="display:block;margin-bottom:10px;letter-spacing:0.5px;">VERIFICACIÓN DE BAJO CONSUMO</strong>
                    • Atendió el cliente: ${
                      verification.details.answeredDoor ? "Sí" : "No"
                    }<br>
                    ${
                      verification.details.answeredDoor
                        ? `
                      • Reportó problemas con el agua: ${
                        verification.details.hadIssues ? "Sí" : "No"
                      }<br>
                      • Tiempo viviendo en la casa: ${
                        verification.details.residenceMonths
                      } meses
                    `
                        : `
                      • Casa parece habitada: ${
                        verification.details.looksLivedIn ? "Sí" : "No"
                      }
                    `
                    }
                  </div>
                `
                    : type === "negativeConsumption"
                    ? `
                  <div style="margin-bottom:8px;font-size:13px;"><strong>CONSUMO:</strong> <span style="color:#dc2626;">${verification.consumption} m³</span></div>
                  <div style="
                    margin-top:15px;
                    padding:15px;
                    background:#fef2f2;
                    border-left:3px solid #dc2626;
                    font-size:12px;
                    line-height:1.5;
                    height:120px;
                    overflow-y:auto;
                  ">
                    <strong style="display:block;margin-bottom:10px;letter-spacing:0.5px;">CONSUMO NEGATIVO VERIFICADO</strong>
                    • Diferencia: ${verification.consumption} m³<br>
                    • Verificado y confirmado por el lector
                  </div>
                `
                    : `
                  <div style="margin-bottom:8px;font-size:13px;"><strong>CONSUMO:</strong> <span style="color:#0d47a1;">${
                    verification.consumption
                  } m³</span></div>
                  <div style="
                    margin-top:15px;
                    padding:15px;
                    background:#f0f9ff;
                    border-left:3px solid #0d47a1;
                    font-size:12px;
                    line-height:1.5;
                    height:120px;
                    overflow-y:auto;
                  ">
                    <strong style="display:block;margin-bottom:10px;letter-spacing:0.5px;">ALTO CONSUMO VERIFICADO</strong>
                    • Consumo promedio: ${verification.average.toFixed(
                      1
                    )} m³<br>
                    • Porcentaje sobre promedio: ${verification.percentageAboveAverage.toFixed(
                      1
                    )}%<br>
                    • Verificado y confirmado por el lector
                  </div>
                `
                }
              </td>
            </tr>
          </table>
        `;
      };

      const htmlContent = `
        <html>
          <head>
            <meta name="viewport" content="width=device-width,initial-scale=1.0">
          </head>
          <body style="margin:0;padding:0;background:#f7fafc;font-family:Arial,sans-serif;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f7fafc;">
              <tr>
                <td align="center" style="padding:30px 20px;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:1200px;">
                    <!-- Header -->
                    <tr>
                      <td style="background:#f8fafc;color:#1a202c;padding:15px 5px;border-bottom:1px solid #edf2f7;">
                        <table width="100%" cellpadding="0" cellspacing="0" border="0">
                          <tr>
                            <td width="130" style="vertical-align:middle;padding-right:20px;padding-top:5px;">
                              <img src="${logoUrl}" alt="COAB Logo" style="max-width:105px;height:auto;display:block;">
                            </td>
                            <td style="text-align:left;vertical-align:middle;">
                              <h2 style="margin:0;font-size:42px;color:#2d3748;font-weight:600;line-height:1.2;">Lecturas: Enero 2024</h2>
                              <p style="margin:5px 0 0;color:#64748b;font-size:16px;line-height:1.2;">Ruta: San_Lorenzo-Portal_Primavera</p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>

                    <!-- Stats Section -->
                    <tr>
                      <td style="padding-top:30px;">
                        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fff;border-radius:4px;border:1px solid #edf2f7;">
                          <tr>
                            <td style="padding:20px;">
                              <div style="
                                font-size:18px;
                                color:#2d3748;
                                border-bottom:1px solid #edf2f7;
                                padding-bottom:12px;
                                margin-bottom:20px;
                                font-weight:600;
                                letter-spacing:0.5px;
                              ">
                                Estadísticas Generales
                              </div>
                              <table width="100%" cellpadding="10" cellspacing="0" border="0">
                                <tr>
                                  <td width="25%" style="padding:10px;">
                                    <div style="
                                      background:#f8fafc;
                                      border:1px solid #edf2f7;
                                      border-radius:4px;
                                      padding:15px;
                                      text-align:center;
                                    ">
                                      <div style="font-size:14px;color:#666;margin-bottom:5px;font-weight:600;">Total Medidores</div>
                                      <div style="font-size:24px;font-weight:bold;color:#1c2c64;">${totalMeters}</div>
                                    </div>
                                  </td>
                                  <td width="25%" style="padding:10px;">
                                    <div style="
                                      background:#f8fafc;
                                      border:1px solid #edf2f7;
                                      border-radius:4px;
                                      padding:15px;
                                      text-align:center;
                                    ">
                                      <div style="font-size:14px;color:#666;margin-bottom:5px;font-weight:600;">Completadas</div>
                                      <div style="font-size:24px;font-weight:bold;color:#1c2c64;">${completedMeters}</div>
                                    </div>
                                  </td>
                                  <td width="25%" style="padding:10px;">
                                    <div style="
                                      background:#f8fafc;
                                      border:1px solid #edf2f7;
                                      border-radius:4px;
                                      padding:15px;
                                      text-align:center;
                                    ">
                                      <div style="font-size:14px;color:#666;margin-bottom:5px;font-weight:600;">Omitidas</div>
                                      <div style="font-size:24px;font-weight:bold;color:#1c2c64;">${skippedMeters}</div>
                                    </div>
                                  </td>
                                  <td width="25%" style="padding:10px;">
                                    <div style="
                                      background:#f8fafc;
                                      border:1px solid #edf2f7;
                                      border-radius:4px;
                                      padding:15px;
                                      text-align:center;
                                    ">
                                      <div style="font-size:14px;color:#666;margin-bottom:5px;font-weight:600;">Porcentaje</div>
                                      <div style="font-size:24px;font-weight:bold;color:#1c2c64;">${Math.round(
                                        (completedMeters / totalMeters) * 100
                                      )}%</div>
                                    </div>
                                  </td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>

                    <!-- Consumption Stats -->
                    <tr>
                      <td style="padding-top:30px;">
                        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fff;border-radius:4px;border:1px solid #edf2f7;">
                          <tr>
                            <td style="padding:20px;">
                              <div style="
                                font-size:18px;
                                color:#2d3748;
                                border-bottom:1px solid #edf2f7;
                                padding-bottom:12px;
                                margin-bottom:20px;
                                font-weight:600;
                                letter-spacing:0.5px;
                              ">
                                Estadísticas de Consumo
                              </div>
                              <table width="100%" cellpadding="10" cellspacing="0" border="0">
                                <tr>
                                  <td width="25%" style="padding:10px;">
                                    <div style="
                                      background:#f8fafc;
                                      border:1px solid #edf2f7;
                                      border-radius:4px;
                                      padding:15px;
                                      text-align:center;
                                    ">
                                      <div style="font-size:14px;color:#666;margin-bottom:5px;font-weight:600;">Consumo Total</div>
                                      <div style="font-size:24px;font-weight:bold;color:#1c2c64;">${totalConsumption} m³</div>
                                    </div>
                                  </td>
                                  <td width="25%" style="padding:10px;">
                                    <div style="
                                      background:#f8fafc;
                                      border:1px solid #edf2f7;
                                      border-radius:4px;
                                      padding:15px;
                                      text-align:center;
                                    ">
                                      <div style="font-size:14px;color:#666;margin-bottom:5px;font-weight:600;">Promedio</div>
                                      <div style="font-size:24px;font-weight:bold;color:#1c2c64;">${avgConsumption} m³</div>
                                    </div>
                                  </td>
                                  <td width="25%" style="padding:10px;">
                                    <div style="
                                      background:#f8fafc;
                                      border:1px solid #edf2f7;
                                      border-radius:4px;
                                      padding:15px;
                                      text-align:center;
                                    ">
                                      <div style="font-size:14px;color:#666;margin-bottom:5px;font-weight:600;">Máximo</div>
                                      <div style="font-size:24px;font-weight:bold;color:#1c2c64;">${maxConsumption} m³</div>
                                    </div>
                                  </td>
                                  <td width="25%" style="padding:10px;">
                                    <div style="
                                      background:#f8fafc;
                                      border:1px solid #edf2f7;
                                      border-radius:4px;
                                      padding:15px;
                                      text-align:center;
                                    ">
                                      <div style="font-size:14px;color:#666;margin-bottom:5px;font-weight:600;">Mínimo</div>
                                      <div style="font-size:24px;font-weight:bold;color:#1c2c64;">${minConsumption} m³</div>
                                    </div>
                                  </td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>

                    <!-- Verification Cards -->
                    <tr>
                      <td style="padding-top:30px;">
                        <table width="100%" cellpadding="15" cellspacing="0" border="0">
                          <tr>
                            <!-- Low Consumption Column -->
                            <td width="33.33%" style="vertical-align:top;">
                              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fff;border-radius:4px;border:1px solid #edf2f7;">
                                <tr>
                                  <td style="border-top:4px solid #1c2c64;padding:20px;">
                                    <div style="
                                      font-size:18px;
                                      color:#1c2c64;
                                      border-bottom:1px solid #edf2f7;
                                      padding-bottom:12px;
                                      margin-bottom:20px;
                                      font-weight:600;
                                      letter-spacing:0.5px;
                                    ">
                                      Bajo Consumo
                                    </div>
                                    ${
                                      verificationsByType.lowConsumption
                                        ?.length > 0
                                        ? verificationsByType.lowConsumption
                                            .map((reading) =>
                                              generateVerificationCard(
                                                reading,
                                                "lowConsumption"
                                              )
                                            )
                                            .join("")
                                        : '<p style="text-align:center;color:#666;padding:20px;">No hay lecturas con bajo consumo</p>'
                                    }
                                  </td>
                                </tr>
                              </table>
                            </td>

                            <!-- Negative Consumption Column -->
                            <td width="33.33%" style="vertical-align:top;">
                              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fff;border-radius:4px;border:1px solid #edf2f7;">
                                <tr>
                                  <td style="border-top:4px solid #dc2626;padding:20px;">
                                    <div style="
                                      font-size:18px;
                                      color:#dc2626;
                                      border-bottom:1px solid #edf2f7;
                                      padding-bottom:12px;
                                      margin-bottom:20px;
                                      font-weight:600;
                                      letter-spacing:0.5px;
                                    ">
                                      Consumo Negativo
                                    </div>
                                    ${
                                      verificationsByType.negativeConsumption
                                        ?.length > 0
                                        ? verificationsByType.negativeConsumption
                                            .map((reading) =>
                                              generateVerificationCard(
                                                reading,
                                                "negativeConsumption"
                                              )
                                            )
                                            .join("")
                                        : '<p style="text-align:center;color:#666;padding:20px;">No hay lecturas con consumo negativo</p>'
                                    }
                                  </td>
                                </tr>
                              </table>
                            </td>

                            <!-- High Consumption Column -->
                            <td width="33.33%" style="vertical-align:top;">
                              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fff;border-radius:4px;border:1px solid #edf2f7;">
                                <tr>
                                  <td style="border-top:4px solid #0d47a1;padding:20px;">
                                    <div style="
                                      font-size:18px;
                                      color:#0d47a1;
                                      border-bottom:1px solid #edf2f7;
                                      padding-bottom:12px;
                                      margin-bottom:20px;
                                      font-weight:600;
                                      letter-spacing:0.5px;
                                    ">
                                      Alto Consumo
                                    </div>
                                    ${
                                      verificationsByType.highConsumption
                                        ?.length > 0
                                        ? verificationsByType.highConsumption
                                            .map((reading) =>
                                              generateVerificationCard(
                                                reading,
                                                "highConsumption"
                                              )
                                            )
                                            .join("")
                                        : '<p style="text-align:center;color:#666;padding:20px;">No hay lecturas con alto consumo</p>'
                                    }
                                  </td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                      <td style="padding-top:40px;text-align:center;border-top:1px solid #edf2f7;">
                        <p style="margin:0;color:#666;font-size:12px;">Este es un correo automático. Por favor no responder.</p>
                        <p style="margin:0;color:#666;font-size:12px;">Generado el ${new Date().toLocaleString(
                          "es-CL",
                          { timeZone: "America/Santiago" }
                        )}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
        </html>
      `;

      document.body.innerHTML = htmlContent;
    };

    generateEmailHtml();
  }, []);

  return null;
}

export default EmailPreviewTable;

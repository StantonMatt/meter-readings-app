import React, { useEffect } from 'react';
import { Box, Container, Button, TextField, MenuItem } from '@mui/material';

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
        residenceMonths: "24"
      }
    }
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
        looksLivedIn: true
      }
    }
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
        residenceMonths: "8"
      }
    }
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
      consumption: -20
    }
  },
  {
    ID: "5678",
    ADDRESS: "567 Test Blvdasdfff asdfas asdf asdf",
    Reading: "150",
    verification: {
      type: "negativeConsumption",
      currentReading: 150,
      previousReading: 180,
      consumption: -30
    }
  },
  {
    ID: "6789",
    ADDRESS: "678 Sample St",
    Reading: "95",
    verification: {
      type: "negativeConsumption",
      currentReading: 95,
      previousReading: 105,
      consumption: -10
    }
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
      percentageAboveAverage: 66.7
    }
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
      percentageAboveAverage: 77.8
    }
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
      percentageAboveAverage: 60.0
    }
  }
];

// Helper function to generate verification card HTML - copied from cloud function
const generateVerificationCard = (reading, type) => {
  const verification = reading.verification;
  const truncateAddress = (address, maxLength = 25) => {
    return address.length > maxLength ? address.substring(0, maxLength) + '...' : address;
  };

  let cardContent = `
    <div class="card" style="
      margin-bottom:15px;
      background:#fff;
      padding:20px;
      border-radius:4px;
      border: 1px solid #edf2f7;
      height:300px;
      display:flex;
      flex-direction:column;
    ">
      <div style="margin-bottom:8px;font-size:13px;"><strong>CLIENTE:</strong> ${reading.ID}</div>
      <div style="margin-bottom:8px;font-size:13px;"><strong>DIRECCIÓN:</strong> ${truncateAddress(reading.ADDRESS || "")}</div>
      <div style="margin-bottom:8px;font-size:13px;"><strong>Lectura Anterior:</strong> ${verification.previousReading || "---"}</div>
      <div style="margin-bottom:8px;font-size:13px;"><strong>Lectura Actual:</strong> ${verification.currentReading || reading.Reading}</div>`;

  const infoBoxStyles = {
    lowConsumption: {
      bg: '#f8fafc',
      border: '#1c2c64',
      title: 'VERIFICACIÓN DE BAJO CONSUMO'
    },
    negativeConsumption: {
      bg: '#fef2f2',
      border: '#dc2626',
      title: 'CONSUMO NEGATIVO VERIFICADO'
    },
    highConsumption: {
      bg: '#f0f9ff',
      border: '#0d47a1',
      title: 'ALTO CONSUMO VERIFICADO'
    }
  };

  const style = infoBoxStyles[type];

  switch (type) {
    case "lowConsumption":
      cardContent += `
        <div style="margin-bottom:8px;font-size:13px;"><strong>CONSUMO:</strong> ${verification.consumption} m³</div>
        <div style="
          margin-top:auto;
          padding:15px;
          background:${style.bg};
          border-left:3px solid ${style.border};
          font-size:12px;
          line-height:1.5;
          height:165px;
          overflow-y:auto;
        ">
          <strong style="font-size:12px;display:block;margin-bottom:10px;letter-spacing:0.5px;">${style.title}</strong>
          • Atendió el cliente: ${verification.details.answeredDoor ? "Sí" : "No"}<br>
          ${verification.details.answeredDoor ? `
            • Reportó problemas con el agua: ${verification.details.hadIssues ? "Sí" : "No"}<br>
            • Tiempo viviendo en la casa: ${verification.details.residenceMonths} meses
          ` : `
            • Casa parece habitada: ${verification.details.looksLivedIn ? "Sí" : "No"}
          `}
        </div>`;
      break;

    case "negativeConsumption":
      cardContent += `
        <div style="margin-bottom:8px;font-size:13px;"><strong>CONSUMO:</strong> <span style="color:#dc2626;">${verification.consumption} m³</span></div>
        <div style="
          margin-top:auto;
          padding:15px;
          background:${style.bg};
          border-left:3px solid ${style.border};
          font-size:12px;
          line-height:1.5;
          height:165px;
          overflow-y:auto;
        ">
          <strong style="font-size:12px;display:block;margin-bottom:10px;letter-spacing:0.5px;">${style.title}</strong>
          • Diferencia: ${verification.consumption} m³<br>
          • Verificado y confirmado por el lector
        </div>`;
      break;

    case "highConsumption":
      cardContent += `
        <div style="margin-bottom:8px;font-size:13px;"><strong>CONSUMO:</strong> <span style="color:#0d47a1;">${verification.consumption} m³</span></div>
        <div style="
          margin-top:auto;
          padding:15px;
          background:${style.bg};
          border-left:3px solid ${style.border};
          font-size:12px;
          line-height:1.5;
          height:165px;
          overflow-y:auto;
        ">
          <strong style="font-size:12px;display:block;margin-bottom:10px;letter-spacing:0.5px;">${style.title}</strong>
          • Consumo promedio: ${verification.average.toFixed(1)} m³<br>
          • Porcentaje sobre promedio: ${verification.percentageAboveAverage.toFixed(1)}%<br>
          • Verificado y confirmado por el lector
        </div>`;
      break;
  }

  cardContent += `</div>`;
  return cardContent;
};

function EmailPreview() {
  useEffect(() => {
    const generateEmailHtml = () => {
      const totalMeters = mockReadings.length;
      const skippedMeters = mockReadings.filter(r => r.Reading === "---").length;
      const completedMeters = totalMeters - skippedMeters;

      const consumptionData = mockReadings
        .filter(r => r.Reading !== "---")
        .map(r => ({
          consumption: r.verification?.consumption || 10,
          current: Number(r.Reading),
          previous: Number(r.Reading) - (r.verification?.consumption || 10)
        }));

      const totalConsumption = consumptionData.reduce((sum, r) => sum + r.consumption, 0);
      const avgConsumption = Math.round(totalConsumption / consumptionData.length);
      const maxConsumption = Math.max(...consumptionData.map(r => r.consumption));
      const minConsumption = Math.min(...consumptionData.map(r => r.consumption));

      const verificationsByType = mockReadings.reduce((acc, reading) => {
        if (reading.verification) {
          const type = reading.verification.type;
          if (!acc[type]) acc[type] = [];
          acc[type].push(reading);
        }
        return acc;
      }, {});

      const logoUrl = "https://firebasestorage.googleapis.com/v0/b/meter-readings-app.appspot.com/o/coab_logo.png?alt=media&token=63c9e784-4e18-40b3-b196-43a924afc7b2";
      const logoHtml = `<div class="logo" style="text-align:center;margin-bottom:20px;"><img src="${logoUrl}" alt="COAB Logo" style="max-width:200px;height:auto;"></div>`;

      // Use hardcoded values since we removed the state
      const month = "Enero";
      const year = "2024";
      const routeId = "San_Lorenzo-Portal_Primavera";

      return `
        <html>
          <head>
            <meta name="viewport" content="width=device-width,initial-scale=1.0">
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                line-height: 1.6;
                color: #1a202c;
                margin: 0;
                padding: 0;
                background: #f7fafc;
                min-height: 100vh;
              }
              .container {
                max-width: 1200px;
                margin: 0 auto;
                padding: 30px 20px;
                min-height: 100vh;
                display: flex;
                flex-direction: column;
              }
              .content-wrapper {
                flex: 1;
              }
              .header {
                background: #1c2c64;
                color: #fff;
                padding: 25px;
                border-radius: 4px;
                text-align: center;
                margin-bottom: 30px;
              }
              .stats-section {
                background: #fff;
                border-radius: 4px;
                padding: 25px;
                margin-bottom: 30px;
                border: 1px solid #edf2f7;
              }
              .section-title {
                font-size: 16px;
                margin-bottom: 20px;
                padding-bottom: 10px;
                border-bottom: 1px solid #edf2f7;
                color: #2d3748;
                font-weight: 600;
                letter-spacing: 0.5px;
              }
              .stats-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                gap: 20px;
                margin-bottom: 30px;
              }
              .stat-item {
                text-align: center;
                padding: 20px;
                background: #f8fafc;
                border-radius: 4px;
                border: 1px solid #edf2f7;
              }
              .verification-table {
                width: 100%;
                border-spacing: 15px;
                border-collapse: separate;
              }
              .verification-cell {
                background: #fff;
                border-radius: 4px;
                padding: 20px;
                vertical-align: top;
                border: 1px solid #edf2f7;
              }
              @media screen and (max-width: 768px) {
                .verification-cell {
                  display: block;
                  width: 100%;
                  margin-bottom: 15px;
                }
              }
              .footer {
                text-align: center;
                padding: 30px 0;
                margin-top: auto;
                border-top: 1px solid #edf2f7;
                color: #666;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="content-wrapper">
                ${logoHtml}
                
                <div class="header">
                  <h2 style="margin:0;">Lecturas: ${month} ${year}</h2>
                  <p style="margin:10px 0 0;opacity:0.9;">Ruta: ${routeId}</p>
                </div>

                <div class="stats-section">
                  <div class="section-title">Resumen de Lecturas</div>
                  <div class="stats-grid">
                    <div class="stat-item">
                      <div style="font-size:14px;color:#666;">Total de Medidores</div>
                      <div style="font-size:24px;font-weight:bold;color:#1c2c64;">${totalMeters}</div>
                    </div>
                    <div class="stat-item">
                      <div style="font-size:14px;color:#666;">Completadas</div>
                      <div style="font-size:24px;font-weight:bold;color:#1c2c64;">${completedMeters}</div>
                    </div>
                    <div class="stat-item">
                      <div style="font-size:14px;color:#666;">Omitidas</div>
                      <div style="font-size:24px;font-weight:bold;color:#1c2c64;">${skippedMeters}</div>
                    </div>
                    <div class="stat-item">
                      <div style="font-size:14px;color:#666;">Porcentaje</div>
                      <div style="font-size:24px;font-weight:bold;color:#1c2c64;">${Math.round((completedMeters / totalMeters) * 100)}%</div>
                    </div>
                  </div>

                  <div class="section-title">Estadísticas de Consumo</div>
                  <div class="stats-grid">
                    <div class="stat-item">
                      <div style="font-size:14px;color:#666;">Consumo Total</div>
                      <div style="font-size:24px;font-weight:bold;color:#1c2c64;">${totalConsumption} m³</div>
                    </div>
                    <div class="stat-item">
                      <div style="font-size:14px;color:#666;">Promedio</div>
                      <div style="font-size:24px;font-weight:bold;color:#1c2c64;">${avgConsumption} m³</div>
                    </div>
                    <div class="stat-item">
                      <div style="font-size:14px;color:#666;">Máximo</div>
                      <div style="font-size:24px;font-weight:bold;color:#1c2c64;">${maxConsumption} m³</div>
                    </div>
                    <div class="stat-item">
                      <div style="font-size:14px;color:#666;">Mínimo</div>
                      <div style="font-size:24px;font-weight:bold;color:#1c2c64;">${minConsumption} m³</div>
                    </div>
                  </div>
                </div>

                <table class="verification-table">
                  <tr>
                    <td class="verification-cell" style="border-top: 4px solid #1c2c64;">
                      <div class="section-title" style="color:#1c2c64;border-bottom-color:#1c2c64;">
                        Bajo Consumo
                      </div>
                      ${verificationsByType.lowConsumption?.length > 0 
                        ? verificationsByType.lowConsumption.map(reading => 
                            generateVerificationCard(reading, "lowConsumption")).join("")
                        : '<p style="text-align:center;color:#666;padding:20px;">No hay lecturas con bajo consumo</p>'
                      }
                    </td>
                    <td class="verification-cell" style="border-top: 4px solid #d32f2f;">
                      <div class="section-title" style="color:#d32f2f;border-bottom-color:#d32f2f;">
                        Consumo Negativo
                      </div>
                      ${verificationsByType.negativeConsumption?.length > 0 
                        ? verificationsByType.negativeConsumption.map(reading => 
                            generateVerificationCard(reading, "negativeConsumption")).join("")
                        : '<p style="text-align:center;color:#666;padding:20px;">No hay lecturas con consumo negativo</p>'
                      }
                    </td>
                    <td class="verification-cell" style="border-top: 4px solid #0d47a1;">
                      <div class="section-title" style="color:#0d47a1;border-bottom-color:#0d47a1;">
                        Alto Consumo
                      </div>
                      ${verificationsByType.highConsumption?.length > 0 
                        ? verificationsByType.highConsumption.map(reading => 
                            generateVerificationCard(reading, "highConsumption")).join("")
                        : '<p style="text-align:center;color:#666;padding:20px;">No hay lecturas con alto consumo</p>'
                      }
                    </td>
                  </tr>
                </table>
              </div>

              <div class="footer">
                <p style="margin:0 0 10px 0;">Este es un correo automático. Por favor no responder.</p>
                <p style="margin:0;">Generado el ${new Date().toLocaleString("es-CL", { timeZone: "America/Santiago" })}</p>
              </div>
            </div>
          </body>
        </html>
      `;
    };

    // Show preview immediately when component mounts
    const html = generateEmailHtml();
    document.body.innerHTML = html;
  }, []); // Empty dependency array means this runs once on mount

  return null; // Component doesn't need to render anything
}

export default EmailPreview; 
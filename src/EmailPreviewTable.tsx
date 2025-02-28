import React, { useEffect } from "react";
import { Box, Container, Button } from "@mui/material";

interface Verification {
  type: string;
  consumption: number;
  currentReading: string;
  previousReading: string;
  details: {
    answeredDoor?: boolean;
    hadIssues?: boolean;
    residenceMonths?: string;
    looksLivedIn?: boolean;
    [key: string]: any;
  };
  average?: number;
  percentageAboveAverage?: number;
  [key: string]: any;
}

interface ReadingData {
  ID: string;
  ADDRESS: string;
  Reading: string;
  verification: Verification;
}

const mockReadings: ReadingData[] = [
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
  // High Consumption Examples
  {
    ID: "3456",
    ADDRESS: "345 Demo Rd",
    Reading: "250",
    verification: {
      type: "highConsumption",
      consumption: 30,
      currentReading: "250",
      previousReading: "220",
      average: 15.5,
      percentageAboveAverage: 93.5,
      details: {},
    },
  },
  // Negative Consumption Examples
  {
    ID: "4567",
    ADDRESS: "456 Example Blvd",
    Reading: "300",
    verification: {
      type: "negativeConsumption",
      consumption: -5,
      currentReading: "300",
      previousReading: "305",
      details: {},
    },
  },
];

interface EmailPreviewTableProps {}

function EmailPreviewTable(props: EmailPreviewTableProps): JSX.Element {
  // Generate the HTML table
  const generateTableHtml = (): string => {
    const logoUrl =
      "https://firebasestorage.googleapis.com/v0/b/meter-readings-app.appspot.com/o/coab_logo.png?alt=media";

    // Calculate statistics
    const totalMeters = mockReadings.length;
    const totalConsumption = mockReadings.reduce(
      (acc, reading) => acc + reading.verification.consumption,
      0
    );
    const avgConsumption = totalConsumption / totalMeters;

    // Generate HTML
    return `
      <html>
        <head>
          <meta name="viewport" content="width=device-width,initial-scale=1.0">
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f7fafc; }
            table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
            th { background-color: #f1f5f9; text-align: left; padding: 10px; }
            td { padding: 10px; border-bottom: 1px solid #e2e8f0; }
            .header { display: flex; align-items: center; margin-bottom: 20px; }
            .header img { height: 60px; margin-right: 20px; }
            .header-text h1 { margin: 0; color: #1a202c; }
            .header-text p { margin: 5px 0 0; color: #4a5568; }
            .stats { display: flex; justify-content: space-between; margin-bottom: 20px; }
            .stats-card { background-color: white; border-radius: 8px; padding: 15px; flex: 1; margin: 0 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
            .stats-card:first-child { margin-left: 0; }
            .stats-card:last-child { margin-right: 0; }
            .stats-value { font-size: 24px; font-weight: bold; color: #2c5282; }
            .stats-label { font-size: 14px; color: #718096; }
            .section-title { font-size: 18px; font-weight: 600; margin: 30px 0 15px; padding-bottom: 8px; border-bottom: 1px solid #e2e8f0; }
            .low-consumption { color: #2c5282; }
            .high-consumption { color: #2b6cb0; }
            .negative-consumption { color: #c53030; }
            .verification-details { background-color: #f8fafc; padding: 10px; border-radius: 4px; margin-top: 5px; font-size: 14px; }
          </style>
        </head>
        <body>
          <!-- Header -->
          <div class="header">
            <img src="${logoUrl}" alt="COAB Logo">
            <div class="header-text">
              <h1>Lecturas: Enero 2025</h1>
              <p>Ruta: San Lorenzo-Portal Primavera</p>
            </div>
          </div>

          <!-- Statistics -->
          <div class="stats">
            <div class="stats-card">
              <div class="stats-value">${totalMeters}</div>
              <div class="stats-label">Total Medidores</div>
            </div>
            <div class="stats-card">
              <div class="stats-value">${totalMeters}</div>
              <div class="stats-label">Lecturas</div>
            </div>
            <div class="stats-card">
              <div class="stats-value">${totalConsumption} m³</div>
              <div class="stats-label">Consumo Total</div>
            </div>
            <div class="stats-card">
              <div class="stats-value">${avgConsumption.toFixed(1)} m³</div>
              <div class="stats-label">Promedio</div>
            </div>
          </div>

          <!-- All Readings Table -->
          <h2 class="section-title">Todas las Lecturas</h2>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Dirección</th>
                <th>Lectura Anterior</th>
                <th>Lectura Actual</th>
                <th>Consumo (m³)</th>
                <th>Tipo</th>
              </tr>
            </thead>
            <tbody>
              ${mockReadings
                .map(
                  (reading) => `
                <tr>
                  <td>${reading.ID}</td>
                  <td>${reading.ADDRESS}</td>
                  <td>${reading.verification.previousReading}</td>
                  <td>${reading.verification.currentReading}</td>
                  <td>${reading.verification.consumption}</td>
                  <td>${
                    reading.verification.type === "lowConsumption"
                      ? '<span class="low-consumption">Bajo</span>'
                      : reading.verification.type === "highConsumption"
                      ? '<span class="high-consumption">Alto</span>'
                      : '<span class="negative-consumption">Negativo</span>'
                  }</td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>

          <!-- Low Consumption Section -->
          <h2 class="section-title low-consumption">Bajo Consumo</h2>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Dirección</th>
                <th>Consumo (m³)</th>
                <th>Detalles</th>
              </tr>
            </thead>
            <tbody>
              ${mockReadings
                .filter((r) => r.verification.type === "lowConsumption")
                .map(
                  (reading) => `
                <tr>
                  <td>${reading.ID}</td>
                  <td>${reading.ADDRESS}</td>
                  <td>${reading.verification.consumption}</td>
                  <td>
                    <div class="verification-details">
                      ${
                        reading.verification.details.answeredDoor
                          ? `
                          • Atendió el cliente: Sí<br>
                          • Reportó problemas con el agua: ${
                            reading.verification.details.hadIssues ? "Sí" : "No"
                          }<br>
                          • Tiempo viviendo en la casa: ${
                            reading.verification.details.residenceMonths
                          } meses
                        `
                          : `
                          • Atendió el cliente: No<br>
                          • Casa parece habitada: ${
                            reading.verification.details.looksLivedIn
                              ? "Sí"
                              : "No"
                          }
                        `
                      }
                    </div>
                  </td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>

          <!-- High Consumption Section -->
          <h2 class="section-title high-consumption">Alto Consumo</h2>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Dirección</th>
                <th>Consumo (m³)</th>
                <th>Promedio (m³)</th>
                <th>% sobre promedio</th>
              </tr>
            </thead>
            <tbody>
              ${mockReadings
                .filter((r) => r.verification.type === "highConsumption")
                .map(
                  (reading) => `
                <tr>
                  <td>${reading.ID}</td>
                  <td>${reading.ADDRESS}</td>
                  <td>${reading.verification.consumption}</td>
                  <td>${reading.verification.average}</td>
                  <td>${reading.verification.percentageAboveAverage}%</td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>

          <!-- Negative Consumption Section -->
          <h2 class="section-title negative-consumption">Consumo Negativo</h2>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Dirección</th>
                <th>Lectura Anterior</th>
                <th>Lectura Actual</th>
                <th>Diferencia (m³)</th>
              </tr>
            </thead>
            <tbody>
              ${mockReadings
                .filter((r) => r.verification.type === "negativeConsumption")
                .map(
                  (reading) => `
                <tr>
                  <td>${reading.ID}</td>
                  <td>${reading.ADDRESS}</td>
                  <td>${reading.verification.previousReading}</td>
                  <td>${reading.verification.currentReading}</td>
                  <td class="negative-consumption">${reading.verification.consumption}</td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
          
          <!-- Footer -->
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #718096; font-size: 12px;">
            <p>Este es un correo automático. Por favor no responder.</p>
            <p>Generado el ${new Date().toLocaleString()}</p>
          </div>
        </body>
      </html>
    `;
  };

  useEffect(() => {
    // Set the iframe content when component mounts
    const iframe = document.getElementById("tablePreview") as HTMLIFrameElement;
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.document.open();
      iframe.contentWindow.document.write(generateTableHtml());
      iframe.contentWindow.document.close();
    }
  }, []);

  return (
    <Container maxWidth={false} style={{ height: "100vh", padding: 0 }}>
      <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <Box
          sx={{
            p: 2,
            display: "flex",
            gap: 2,
            borderBottom: "1px solid #e0e0e0",
          }}
        >
          <Button
            variant="contained"
            onClick={() => {
              window.location.href = "/";
            }}
          >
            Volver
          </Button>
          <Button
            variant="outlined"
            onClick={() => {
              window.location.href = "/email-preview";
            }}
          >
            Ver Versión Email
          </Button>
        </Box>
        <Box sx={{ flex: 1, overflow: "hidden" }}>
          <iframe
            id="tablePreview"
            style={{ width: "100%", height: "100%", border: "none" }}
            title="Email Table Preview"
          />
        </Box>
      </Box>
    </Container>
  );
}

export default EmailPreviewTable;

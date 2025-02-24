import React, { useEffect } from 'react';
import { Box, Container, Button, TextField, MenuItem } from '@mui/material';

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
      details: {}
    }
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
      details: {}
    }
  }
];

interface EmailPreviewProps {}

function EmailPreview(props: EmailPreviewProps): JSX.Element {
  // Utility function to generate verification card HTML
  const generateVerificationCard = (reading: ReadingData): string => {
    const { verification } = reading;
    const truncateAddress = (address: string, maxLength: number = 25): string => {
      return address.length > maxLength ? address.substring(0, maxLength) + '...' : address;
    };

    // Generate details based on verification type
    let verificationDetails = '';
    if (verification.type === "lowConsumption") {
      if (verification.details.answeredDoor) {
        verificationDetails = `
          • Atendió el cliente: Sí<br>
          • Reportó problemas con el agua: ${verification.details.hadIssues ? "Sí" : "No"}<br>
          • Tiempo viviendo en la casa: ${verification.details.residenceMonths} meses
        `;
      } else {
        verificationDetails = `
          • Atendió el cliente: No<br>
          • Casa parece habitada: ${verification.details.looksLivedIn ? "Sí" : "No"}
        `;
      }
    }

    const cardHtml = `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:15px;background:#fff;border:1px solid #edf2f7;border-radius:4px;">
        <tr>
          <td style="padding:15px;">
            <div style="margin-bottom:8px;font-size:13px;"><strong>CLIENTE:</strong> ${reading.ID}</div>
            <div style="margin-bottom:8px;font-size:13px;"><strong>DIRECCIÓN:</strong> ${truncateAddress(reading.ADDRESS)}</div>
            <div style="margin-bottom:8px;font-size:13px;"><strong>Lectura Anterior:</strong> ${verification.previousReading}</div>
            <div style="margin-bottom:8px;font-size:13px;"><strong>Lectura Actual:</strong> ${verification.currentReading}</div>
            ${
              verification.type === "lowConsumption" ? `
                <div style="margin-bottom:8px;font-size:13px;"><strong>CONSUMO:</strong> ${verification.consumption} m³</div>
                <div style="margin-top:15px;padding:15px;background:#f8fafc;border-left:3px solid #1c2c64;font-size:12px;line-height:1.5;">
                  <strong style="display:block;margin-bottom:10px;letter-spacing:0.5px;">VERIFICACIÓN DE BAJO CONSUMO</strong>
                  ${verificationDetails}
                </div>
              ` : verification.type === "negativeConsumption" ? `
                <div style="margin-bottom:8px;font-size:13px;"><strong>CONSUMO:</strong> <span style="color:#dc2626;">${verification.consumption} m³</span></div>
                <div style="margin-top:15px;padding:15px;background:#fef2f2;border-left:3px solid #dc2626;font-size:12px;line-height:1.5;">
                  <strong style="display:block;margin-bottom:10px;letter-spacing:0.5px;">CONSUMO NEGATIVO VERIFICADO</strong>
                  • Diferencia: ${verification.consumption} m³<br>
                  • Verificado y confirmado por el lector
                </div>
              ` : `
                <div style="margin-bottom:8px;font-size:13px;"><strong>CONSUMO:</strong> <span style="color:#0d47a1;">${verification.consumption} m³</span></div>
                <div style="margin-top:15px;padding:15px;background:#f0f9ff;border-left:3px solid #0d47a1;font-size:12px;line-height:1.5;">
                  <strong style="display:block;margin-bottom:10px;letter-spacing:0.5px;">ALTO CONSUMO VERIFICADO</strong>
                  • Consumo promedio: ${verification.average} m³<br>
                  • Porcentaje sobre promedio: ${verification.percentageAboveAverage}%<br>
                  • Verificado y confirmado por el lector
                </div>
              `
            }
          </td>
        </tr>
      </table>
    `;
    return cardHtml;
  };

  // Generate verification section HTML
  const generateVerificationSection = (type: string, readings: ReadingData[]): string => {
    const filteredReadings = readings.filter(r => r.verification.type === type);
    
    let title, borderColor;
    switch (type) {
      case "lowConsumption":
        title = "Bajo Consumo";
        borderColor = "#1c2c64";
        break;
      case "negativeConsumption":
        title = "Consumo Negativo";
        borderColor = "#dc2626";
        break;
      case "highConsumption":
        title = "Alto Consumo";
        borderColor = "#0d47a1";
        break;
      default:
        title = "Verificaciones";
        borderColor = "#333333";
    }
    
    return `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fff;border-radius:4px;border:1px solid #edf2f7;">
        <tr>
          <td style="border-top:4px solid ${borderColor};padding:20px;">
            <div style="font-size:18px;color:${borderColor};border-bottom:1px solid #edf2f7;padding-bottom:12px;margin-bottom:20px;font-weight:600;letter-spacing:0.5px;">
              ${title} (${filteredReadings.length})
            </div>
            ${filteredReadings.map(reading => generateVerificationCard(reading)).join('')}
            ${filteredReadings.length === 0 ? '<p style="text-align:center;color:#666;padding:20px;">No hay lecturas en esta categoría</p>' : ''}
          </td>
        </tr>
      </table>
    `;
  };

  // Generate stats section HTML
  const generateStatsSection = (): string => {
    // Calculate statistics
    const totalMeters = mockReadings.length;
    const totalConsumption = mockReadings.reduce((acc, reading) => acc + reading.verification.consumption, 0);
    const avgConsumption = totalConsumption / totalMeters;
    
    const statsHtml = `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fff;border-radius:4px;border:1px solid #edf2f7;">
        <tr>
          <td style="padding:20px;">
            <div style="font-size:18px;color:#2d3748;border-bottom:1px solid #edf2f7;padding-bottom:12px;margin-bottom:20px;font-weight:600;letter-spacing:0.5px;">
              Estadísticas Generales
            </div>
            <table width="100%" cellpadding="10" cellspacing="0" border="0">
              <tr>
                <td width="25%" style="padding:10px;">
                  <div style="background:#f8fafc;border:1px solid #edf2f7;border-radius:4px;padding:15px;text-align:center;">
                    <div style="font-size:14px;color:#666;margin-bottom:5px;font-weight:600;">Total Medidores</div>
                    <div style="font-size:24px;font-weight:bold;color:#1c2c64;">${totalMeters}</div>
                  </div>
                </td>
                <td width="25%" style="padding:10px;">
                  <div style="background:#f8fafc;border:1px solid #edf2f7;border-radius:4px;padding:15px;text-align:center;">
                    <div style="font-size:14px;color:#666;margin-bottom:5px;font-weight:600;">Lecturas</div>
                    <div style="font-size:24px;font-weight:bold;color:#1c2c64;">${totalMeters}</div>
                  </div>
                </td>
                <td width="25%" style="padding:10px;">
                  <div style="background:#f8fafc;border:1px solid #edf2f7;border-radius:4px;padding:15px;text-align:center;">
                    <div style="font-size:14px;color:#666;margin-bottom:5px;font-weight:600;">Consumo Total</div>
                    <div style="font-size:24px;font-weight:bold;color:#1c2c64;">${totalConsumption} m³</div>
                  </div>
                </td>
                <td width="25%" style="padding:10px;">
                  <div style="background:#f8fafc;border:1px solid #edf2f7;border-radius:4px;padding:15px;text-align:center;">
                    <div style="font-size:14px;color:#666;margin-bottom:5px;font-weight:600;">Promedio</div>
                    <div style="font-size:24px;font-weight:bold;color:#1c2c64;">${avgConsumption.toFixed(1)} m³</div>
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    `;
    return statsHtml;
  };

  const logoUrl = "https://firebasestorage.googleapis.com/v0/b/meter-readings-app.appspot.com/o/coab_logo.png?alt=media";
  
  // Generate complete email HTML
  const generateEmailHtml = (): string => {
    const emailHtml = `
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
                            <h2 style="margin:0;font-size:42px;color:#2d3748;font-weight:600;line-height:1.2;">Lecturas: Enero 2025</h2>
                            <p style="margin:5px 0 0;color:#64748b;font-size:16px;line-height:1.2;">Ruta: San Lorenzo-Portal Primavera</p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <!-- Stats Section -->
                  <tr>
                    <td style="padding-top:30px;">
                      ${generateStatsSection()}
                    </td>
                  </tr>

                  <!-- Verification Cards -->
                  <tr>
                    <td style="padding-top:30px;">
                      <table width="100%" cellpadding="15" cellspacing="0" border="0">
                        <tr>
                          <!-- Low Consumption Column -->
                          <td width="33.33%" style="vertical-align:top;">
                            ${generateVerificationSection("lowConsumption", mockReadings)}
                          </td>

                          <!-- Negative Consumption Column -->
                          <td width="33.33%" style="vertical-align:top;">
                            ${generateVerificationSection("negativeConsumption", mockReadings)}
                          </td>

                          <!-- High Consumption Column -->
                          <td width="33.33%" style="vertical-align:top;">
                            ${generateVerificationSection("highConsumption", mockReadings)}
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="padding-top:40px;text-align:center;border-top:1px solid #edf2f7;">
                      <p style="margin:0;color:#666;font-size:12px;">Este es un correo automático. Por favor no responder.</p>
                      <p style="margin:0;color:#666;font-size:12px;">Generado el ${new Date().toLocaleString()}</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;
    return emailHtml;
  };

  useEffect(() => {
    // Set the iframe content when component mounts
    const iframe = document.getElementById('emailPreview') as HTMLIFrameElement;
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.document.open();
      iframe.contentWindow.document.write(generateEmailHtml());
      iframe.contentWindow.document.close();
    }
  }, []);

  return (
    <Container maxWidth={false} style={{ height: '100vh', padding: 0 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Box sx={{ p: 2, display: 'flex', gap: 2, borderBottom: '1px solid #e0e0e0' }}>
          <Button 
            variant="contained" 
            onClick={() => {
              window.location.href = '/';
            }}
          >
            Volver
          </Button>
          <Button 
            variant="outlined"
            onClick={() => {
              window.location.href = '/email-preview-table';
            }}
          >
            Ver Versión Tabular
          </Button>
        </Box>
        <Box sx={{ flex: 1, overflow: 'hidden' }}>
          <iframe 
            id="emailPreview"
            style={{ width: '100%', height: '100%', border: 'none' }}
            title="Email Preview"
          />
        </Box>
      </Box>
    </Container>
  );
}

export default EmailPreview;
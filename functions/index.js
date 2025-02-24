/* eslint-disable no-undef */
console.log("Using production v2 trigger");
const { onCall } = require("firebase-functions/v2/https");
const nodemailer = require("nodemailer");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

// Initialize Firebase Admin
initializeApp();

// Create an HTTPS endpoint with CORS handling
exports.sendReadingsMail = onCall(
  {
    maxInstances: 1,
    minInstances: 0,
    timeoutSeconds: 540,
    memory: "128MiB",
    region: "us-central1",
    secrets: ["EMAIL_SENDER", "EMAIL_AUTH_KEY"],
    cpu: "gcf_gen1",
    enforceAppCheck: true,
    consumeAppCheckToken: false,
    cors: ["http://localhost:5173", "https://meter-readings-app.web.app"],
  },
  async (request) => {
    try {
      // Verify both auth and App Check
      if (!request.auth) {
        throw new Error("Unauthorized - User not authenticated");
      }

      if (!request.app) {
        throw new Error("Unauthorized - Invalid App Check token");
      }

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.EMAIL_SENDER,
          pass: process.env.EMAIL_AUTH_KEY,
        },
      });

      const readingsData = request.data;
      console.log("Processing data:", JSON.stringify(readingsData, null, 2));

      if (!readingsData || !readingsData.readings) {
        throw new Error("Invalid document structure");
      }

      // Enhanced statistics
      const totalMeters = readingsData.readings.length;
      const readings = readingsData.readings.map((meter) => {
        const sortedReadings = Object.entries(meter)
          .filter(([key]) => key !== "ID" && key !== "ADDRESS")
          .sort((a, b) => b[0].localeCompare(a[0]));
        return {
          current: sortedReadings[0]?.[1] || "---",
          previous: sortedReadings[1]?.[1] || "---",
          isSkipped: sortedReadings[0]?.[1] === "---",
        };
      });

      const skippedMeters = readings.filter((r) => r.isSkipped).length;
      const completedMeters = totalMeters - skippedMeters;

      // Calculate consumption stats
      const consumptionData = readings
        .filter((r) => !r.isSkipped && r.previous !== "---")
        .map((r) => ({
          consumption: Number(r.current) - Number(r.previous),
          current: Number(r.current),
          previous: Number(r.previous),
        }));

      const totalConsumption = consumptionData.reduce(
        (sum, r) => sum + r.consumption,
        0
      );
      const avgConsumption =
        consumptionData.length > 0
          ? Math.round(totalConsumption / consumptionData.length)
          : 0;
      const maxConsumption =
        consumptionData.length > 0
          ? Math.max(...consumptionData.map((r) => r.consumption))
          : 0;
      const minConsumption =
        consumptionData.length > 0
          ? Math.min(...consumptionData.map((r) => r.consumption))
          : 0;

      // Group verifications by type
      const verificationsByType = readingsData.readings.reduce(
        (acc, reading) => {
          if (reading.verification) {
            const type = reading.verification.type;
            if (!acc[type]) acc[type] = [];
            acc[type].push(reading);
          }
          return acc;
        },
        {}
      );

      // Helper function to generate verification card HTML
      const generateVerificationCard = (reading, type) => {
        const verification = reading.verification;
        let cardContent = `
          <div class="card" style="margin-bottom:15px;">
            <div style="margin-bottom:10px;"><strong>CLIENTE:</strong> ${
              reading.ID
            }</div>
            <div style="margin-bottom:10px;"><strong>DIRECCIÓN:</strong> ${
              reading.ADDRESS || ""
            }</div>
            <div style="margin-bottom:10px;"><strong>Lectura Anterior:</strong> ${
              verification.previousReading || "---"
            }</div>
            <div style="margin-bottom:10px;"><strong>Lectura Actual:</strong> ${
              verification.currentReading || reading.Reading
            }</div>`;

        switch (type) {
          case "lowConsumption":
            cardContent += `
              <div style="margin-bottom:10px;"><strong>CONSUMO:</strong> ${
                verification.consumption
              } m³</div>
              <div style="margin-top:10px;padding:10px;background:#f0f4ff;border-left:4px solid #1c2c64;">
                <strong>VERIFICACIÓN DE BAJO CONSUMO:</strong><br>
                • Atendió el cliente: ${
                  verification.details.answeredDoor ? "Sí" : "No"
                }<br>`;

            if (verification.details.answeredDoor) {
              cardContent += `
                • Reportó problemas con el agua: ${
                  verification.details.hadIssues ? "Sí" : "No"
                }<br>
                • Tiempo viviendo en la casa: ${
                  verification.details.residenceMonths
                } meses`;
            } else {
              cardContent += `
                • Casa parece habitada: ${
                  verification.details.looksLivedIn ? "Sí" : "No"
                }`;
            }
            break;

          case "negativeConsumption":
            cardContent += `
              <div style="margin-bottom:10px;"><strong>CONSUMO:</strong> <span style="color:#d32f2f;">${verification.consumption} m³</span></div>
              <div style="margin-top:10px;padding:10px;background:#fee2e2;border-left:4px solid #dc2626;">
                <strong>CONSUMO NEGATIVO VERIFICADO</strong><br>
                • Diferencia: ${verification.consumption} m³<br>
                • Verificado y confirmado por el lector
              </div>`;
            break;

          case "highConsumption":
            cardContent += `
              <div style="margin-bottom:10px;"><strong>CONSUMO:</strong> <span style="color:#0d47a1;">${
                verification.consumption
              } m³</span></div>
              <div style="margin-top:10px;padding:10px;background:#e3f2fd;border-left:4px solid #0d47a1;">
                <strong>ALTO CONSUMO VERIFICADO</strong><br>
                • Consumo promedio: ${verification.average.toFixed(1)} m³<br>
                • Porcentaje sobre promedio: ${verification.percentageAboveAverage.toFixed(
                  1
                )}%<br>
                • Verificado y confirmado por el lector
              </div>`;
            break;
        }

        cardContent += `</div></div>`;
        return cardContent;
      };

      // Generate HTML for each verification type
      const verificationSections = [];

      if (verificationsByType.lowConsumption?.length > 0) {
        verificationSections.push(`
          <div class="section-title">Lecturas con Bajo Consumo (${
            verificationsByType.lowConsumption.length
          })</div>
          <div class="card">
            ${verificationsByType.lowConsumption
              .map((reading) =>
                generateVerificationCard(reading, "lowConsumption")
              )
              .join("")}
          </div>
        `);
      }

      if (verificationsByType.negativeConsumption?.length > 0) {
        verificationSections.push(`
          <div class="section-title">Lecturas con Consumo Negativo (${
            verificationsByType.negativeConsumption.length
          })</div>
          <div class="card">
            ${verificationsByType.negativeConsumption
              .map((reading) =>
                generateVerificationCard(reading, "negativeConsumption")
              )
              .join("")}
          </div>
        `);
      }

      if (verificationsByType.highConsumption?.length > 0) {
        verificationSections.push(`
          <div class="section-title">Lecturas con Alto Consumo (${
            verificationsByType.highConsumption.length
          })</div>
          <div class="card">
            ${verificationsByType.highConsumption
              .map((reading) =>
                generateVerificationCard(reading, "highConsumption")
              )
              .join("")}
          </div>
        `);
      }

      // Generate CSV content
      const csvRows = [
        "ID,Direccion,Lectura Anterior,Lectura Actual,Estado,Consumo\n",
      ];
      readingsData.readings.forEach((meter) => {
        const readings = Object.entries(meter)
          .filter(([key]) => key !== "ID" && key !== "ADDRESS")
          .sort((a, b) => b[0].localeCompare(a[0]));

        const currentReading = readings[0]?.[1] || "---";
        const lastReading = readings[1]?.[1] || "---";
        const status = currentReading === "---" ? "Omitido" : "Confirmado";
        const consumption =
          currentReading !== "---" && lastReading !== "---"
            ? parseInt(currentReading) - parseInt(lastReading)
            : "---";

        csvRows.push(
          `${meter.ID},"${
            meter.ADDRESS || ""
          }",${lastReading},${currentReading},${status},${consumption}\n`
        );
      });

      const csvContent = csvRows.join("");

      // Use the public URL for the logo
      const logoUrl =
        "https://firebasestorage.googleapis.com/v0/b/meter-readings-app.firebasestorage.app/o/coab_logo.png?alt=media&token=63c9e784-4e18-40b3-b196-43a924afc7b2";

      // Updated: Minified and inlined email template to avoid Gmail clipping
      const logoHtml = `<div class="logo"><img src="${logoUrl}" alt="COAB Logo" style="max-width:200px;height:auto;"></div>`;

      // Update the HTML content with side-by-side columns
      const htmlContent = `<html>
        <head>
          <meta name="viewport" content="width=device-width,initial-scale=1.0">
          <style type="text/css">
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              margin: 0;
              padding: 0;
              background: #f8f9fa;
            }
            .container {
              width: 100%;
              max-width: 1200px;
              margin: 0 auto;
              padding: 20px;
              box-sizing: border-box;
            }
            .header {
              background: #1c2c64;
              color: #fff;
              padding: 25px;
              border-radius: 12px;
              text-align: center;
              margin-bottom: 30px;
            }
            .stats-section {
              background: #fff;
              border-radius: 12px;
              padding: 20px;
              margin-bottom: 30px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.05);
            }
            .section-title {
              font-size: 20px;
              margin-bottom: 20px;
              padding-bottom: 10px;
              border-bottom: 2px solid #1c2c64;
              color: #1c2c64;
            }
            .stats-grid {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
              gap: 20px;
              margin-bottom: 20px;
            }
            .stat-item {
              text-align: center;
              padding: 15px;
              background: #f8f9fa;
              border-radius: 8px;
            }
            .verification-columns {
              display: flex;
              flex-direction: row;
              gap: 20px;
              margin-top: 30px;
            }
            
            .verification-column {
              flex: 1;
              min-width: 300px;
              background: #fff;
              border-radius: 12px;
              padding: 20px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.05);
            }
            
            /* Column-specific styles */
            .low-consumption-column .section-title {
              color: #1c2c64;
              border-bottom-color: #1c2c64;
            }
            
            .negative-consumption-column .section-title {
              color: #d32f2f;
              border-bottom-color: #d32f2f;
            }
            
            .high-consumption-column .section-title {
              color: #0d47a1;
              border-bottom-color: #0d47a1;
            }

            @media screen and (max-width: 768px) {
              .verification-columns {
                flex-direction: column;
              }
              .verification-column {
                width: 100%;
              }
            }
          </style>
        </head>
        <body>
          <div class="container">
            ${logoHtml}
            
            <div class="header">
              <h2 style="margin:0;">Lecturas: ${readingsData.month} ${readingsData.year}</h2>
              <p style="margin:10px 0 0;opacity:0.9;">Ruta: ${readingsData.routeId}</p>
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
                  <div style="font-size:24px;font-weight:bold;color:#1c2c64;">${Math.round(
                    (completedMeters / totalMeters) * 100
                  )}%</div>
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

            <div class="verification-columns">
              ${
                verificationsByType.lowConsumption?.length > 0
                  ? `
                <div class="verification-column low-consumption-column">
                  <div class="section-title">Lecturas con Bajo Consumo (${verificationsByType.lowConsumption.length})</div>
                  ${verificationsByType.lowConsumption
                    .map((reading) =>
                      generateVerificationCard(reading, "lowConsumption")
                    )
                    .join("")}
                </div>
              `
                  : ""
              }

              ${
                verificationsByType.negativeConsumption?.length > 0
                  ? `
                <div class="verification-column negative-consumption-column">
                  <div class="section-title">Lecturas con Consumo Negativo (${verificationsByType.negativeConsumption.length})</div>
                  ${verificationsByType.negativeConsumption
                    .map((reading) =>
                      generateVerificationCard(reading, "negativeConsumption")
                    )
                    .join("")}
                </div>
              `
                  : ""
              }

              ${
                verificationsByType.highConsumption?.length > 0
                  ? `
                <div class="verification-column high-consumption-column">
                  <div class="section-title">Lecturas con Alto Consumo (${verificationsByType.highConsumption.length})</div>
                  ${verificationsByType.highConsumption
                    .map((reading) =>
                      generateVerificationCard(reading, "highConsumption")
                    )
                    .join("")}
                </div>
              `
                  : ""
              }
            </div>

            <div class="footer">
              <p>Adjunto encontrará el archivo CSV con el detalle de las lecturas.</p>
              <p>Este es un correo automático. Por favor no responder.</p>
              <p>Generado el ${new Date().toLocaleString("es-CL", { timeZone: "America/Santiago" })}</p>
            </div>
          </div>
        </body>
      </html>`;

      // Get email recipients from Firestore
      const db = getFirestore();
      const configDoc = await db.collection("config").doc("email").get();

      if (!configDoc.exists || !configDoc.data().recipients?.length) {
        throw new Error(
          "No email recipients configured. Please set up recipients in Firestore."
        );
      }

      const recipients = configDoc.data().recipients;

      // Also update the text content to include our detail
      const textContent =
        `Lecturas: ${readingsData.month} ${readingsData.year}\n\n` +
        `Ruta: ${readingsData.routeId}\n\n` +
        `Resumen:\n` +
        `- Total de Medidores: ${totalMeters}\n` +
        `- Lecturas Completadas: ${completedMeters}\n` +
        `- Lecturas Omitidas: ${skippedMeters}\n` +
        `- Porcentaje Completado: ${Math.round(
          (completedMeters / totalMeters) * 100
        )}%\n\n` +
        `Estadísticas de Consumo:\n` +
        `- Consumo Total: ${totalConsumption} m³\n` +
        `- Consumo Promedio: ${avgConsumption} m³\n` +
        `- Consumo Máximo: ${maxConsumption} m³\n` +
        `- Consumo Mínimo: ${minConsumption} m³\n\n` +
        `Lecturas con Verificación:\n\n${readingsData.emailContent
          .split("----------------------------------------")
          .filter((section) => section.trim())
          .filter((section) => section.includes("NOTA DE VERIFICACIÓN"))
          .join("\n\n")}\n\n` +
        `Adjunto encontrará el archivo CSV con el detalle de las lecturas.\n\n` +
        `Este es un correo automático. Por favor no responder.\n` +
        `Generado el ${new Date().toLocaleString("es-CL", {
          timeZone: "America/Santiago",
        })}`;

      // Update the mailOptions
      const mailOptions = {
        from: process.env.EMAIL_SENDER,
        to: recipients,
        subject: `Lecturas: ${readingsData.routeId} - ${readingsData.month} ${readingsData.year}`,
        html: htmlContent,
        text: textContent,
        attachments: [
          {
            filename: `lecturas-${readingsData.routeId}-${readingsData.year}-${readingsData.month}.csv`,
            content: csvContent,
          },
        ],
      };

      console.log(
        "Sending email with options:",
        JSON.stringify(mailOptions, null, 2)
      );
      const result = await transporter.sendMail(mailOptions);
      console.log("Email sent successfully:", result);

      return { success: true, message: "Email sent successfully" };
    } catch (error) {
      console.error("Function error:", error);
      throw new Error(`Failed to process readings: ${error.message}`);
    }
  }
);

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

      // Use statistics from the request
      const stats = readingsData.statistics || {};
      console.log("Using statistics:", stats);

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
        {},
      );

      // Helper function to generate verification card HTML
      const generateVerificationCard = (reading, type) => {
        const verification = reading.verification;
        const truncateAddress = (address, maxLength = 25) => {
          return address.length > maxLength ?
            address.substring(0, maxLength) + "..." :
            address;
        };

        // Switch to table-based card layout
        return `
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:15px;background:#fff;border:1px solid #edf2f7;border-radius:4px;">
            <tr>
              <td style="padding:15px;">
                <div style="margin-bottom:8px;font-size:13px;"><strong>CLIENTE:</strong> ${
  reading.ID
}</div>
                <div style="margin-bottom:8px;font-size:13px;"><strong>DIRECCIÓN:</strong> ${truncateAddress(
    reading.ADDRESS || "",
  )}</div>
                <div style="margin-bottom:8px;font-size:13px;"><strong>Lectura Anterior:</strong> ${
  verification.previousReading || "---"
}</div>
                <div style="margin-bottom:8px;font-size:13px;"><strong>Lectura Actual:</strong> ${
  verification.currentReading || reading.Reading
}</div>
                ${
  type === "lowConsumption" ?
    `
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
  verification.details.answeredDoor ?
    `
                      • Reportó problemas con el agua: ${
  verification.details.hadIssues ? "Sí" : "No"
}<br>
                      • Tiempo viviendo en la casa: ${
  verification.details.residenceMonths
} meses
                    ` :
    `
                      • Casa parece habitada: ${
  verification.details.looksLivedIn ? "Sí" : "No"
}
                    `
}
                  </div>
                ` :
    type === "negativeConsumption" ?
      `
                  <div style="margin-bottom:8px;font-size:13px;"><strong>CONSUMO:</strong> <span style="color:#dc2626;">${verification.consumption} m³</span></div>
                  <div style="margin-top:15px;padding:15px;background:#fef2f2;border-left:3px solid #dc2626;font-size:12px;line-height:1.5;">
                    <strong style="display:block;margin-bottom:10px;letter-spacing:0.5px;">CONSUMO NEGATIVO VERIFICADO</strong>
                    • Diferencia: ${verification.consumption} m³<br>
                    • Verificado y confirmado por el lector
                  </div>
                ` :
      `
                  <div style="margin-bottom:8px;font-size:13px;"><strong>CONSUMO:</strong> <span style="color:#0d47a1;">${
  verification.consumption
} m³</span></div>
                  <div style="margin-top:15px;padding:15px;background:#f0f9ff;border-left:3px solid #0d47a1;font-size:12px;line-height:1.5;">
                    <strong style="display:block;margin-bottom:10px;letter-spacing:0.5px;">ALTO CONSUMO VERIFICADO</strong>
                    • Consumo promedio: ${verification.average.toFixed(
    1,
  )} m³<br>
                    • Porcentaje sobre promedio: ${verification.percentageAboveAverage.toFixed(
    1,
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
      generateVerificationCard(reading, "lowConsumption"),
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
      generateVerificationCard(reading, "negativeConsumption"),
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
      generateVerificationCard(reading, "highConsumption"),
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
        const currentReading = meter.currentReading || "---";
        const previousReading = meter.previousReading || "---";
        const status = currentReading === "---" ? "Omitido" : "Confirmado";
        const consumption = meter.consumption || "---";

        csvRows.push(
          `${meter.ID},"${
            meter.ADDRESS || ""
          }",${previousReading},${currentReading},${status},${consumption}\n`,
        );
      });

      const csvContent = csvRows.join("");

      // Use the public URL for the logo
      const logoUrl =
        "https://firebasestorage.googleapis.com/v0/b/meter-readings-app.appspot.com/o/coab_logo.png?alt=media&token=63c9e784-4e18-40b3-b196-43a924afc7b2";

      // Update the HTML content with table-based layout
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
                              <h2 style="margin:0;font-size:42px;color:#2d3748;font-weight:600;line-height:1.2;">Lecturas: ${
  readingsData.month
} ${readingsData.year}</h2>
                              <p style="margin:5px 0 0;color:#64748b;font-size:16px;line-height:1.2;">Ruta: ${
  readingsData.routeId
}</p>
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
                                      <div style="font-size:24px;font-weight:bold;color:#1c2c64;">${
  stats.totalMeters
}</div>
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
                                      <div style="font-size:24px;font-weight:bold;color:#1c2c64;">${
  stats.completedMeters
}</div>
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
                                      <div style="font-size:24px;font-weight:bold;color:#1c2c64;">${
  stats.skippedMeters
}</div>
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
    (stats.completedMeters /
                                          stats.totalMeters) *
                                          100,
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

                    <!-- Consumption Stats Section -->
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
                                      <div style="font-size:24px;font-weight:bold;color:#1c2c64;">${
  stats.totalConsumption
} m³</div>
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
                                      <div style="font-size:24px;font-weight:bold;color:#1c2c64;">${
  stats.avgConsumption
} m³</div>
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
                                      <div style="font-size:24px;font-weight:bold;color:#1c2c64;">${
  stats.maxConsumption
} m³</div>
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
                                      <div style="font-size:24px;font-weight:bold;color:#1c2c64;">${
  stats.minConsumption
} m³</div>
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
    ?.length > 0 ?
    verificationsByType.lowConsumption
      .map((reading) =>
        generateVerificationCard(
          reading,
          "lowConsumption",
        ),
      )
      .join("") :
    "<p style=\"text-align:center;color:#666;padding:20px;\">No hay lecturas con bajo consumo</p>"
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
    ?.length > 0 ?
    verificationsByType.negativeConsumption
      .map((reading) =>
        generateVerificationCard(
          reading,
          "negativeConsumption",
        ),
      )
      .join("") :
    "<p style=\"text-align:center;color:#666;padding:20px;\">No hay lecturas con consumo negativo</p>"
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
    ?.length > 0 ?
    verificationsByType.highConsumption
      .map((reading) =>
        generateVerificationCard(
          reading,
          "highConsumption",
        ),
      )
      .join("") :
    "<p style=\"text-align:center;color:#666;padding:20px;\">No hay lecturas con alto consumo</p>"
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
    { timeZone: "America/Santiago" },
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

      // Get email recipients from Firestore
      const db = getFirestore();
      const configDoc = await db.collection("config").doc("email").get();

      if (!configDoc.exists || !configDoc.data().recipients?.length) {
        throw new Error(
          "No email recipients configured. Please set up recipients in Firestore.",
        );
      }

      const recipients = configDoc.data().recipients;

      // Also update the text content to include our detail
      const textContent =
        `Lecturas: ${readingsData.month} ${readingsData.year}\n\n` +
        `Ruta: ${readingsData.routeId}\n\n` +
        "Resumen:\n" +
        `- Total de Medidores: ${stats.totalMeters}\n` +
        `- Lecturas Completadas: ${stats.completedMeters}\n` +
        `- Lecturas Omitidas: ${stats.skippedMeters}\n` +
        `- Porcentaje Completado: ${Math.round(
          (stats.completedMeters / stats.totalMeters) * 100,
        )}%\n\n` +
        "Estadísticas de Consumo:\n" +
        `- Consumo Total: ${stats.totalConsumption} m³\n` +
        `- Consumo Promedio: ${stats.avgConsumption} m³\n` +
        `- Consumo Máximo: ${stats.maxConsumption} m³\n` +
        `- Consumo Mínimo: ${stats.minConsumption} m³\n\n` +
        `Lecturas con Verificación:\n\n${readingsData.emailContent
          .split("----------------------------------------")
          .filter((section) => section.trim())
          .filter((section) => section.includes("NOTA DE VERIFICACIÓN"))
          .join("\n\n")}\n\n` +
        "Adjunto encontrará el archivo CSV con el detalle de las lecturas.\n\n" +
        "Este es un correo automático. Por favor no responder.\n" +
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
        JSON.stringify(mailOptions, null, 2),
      );
      const result = await transporter.sendMail(mailOptions);
      console.log("Email sent successfully:", result);

      return { success: true, message: "Email sent successfully" };
    } catch (error) {
      console.error("Function error:", error);
      throw new Error(`Failed to process readings: ${error.message}`);
    }
  },
);

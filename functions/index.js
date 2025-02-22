/* eslint-disable no-undef */
console.log("Using new v2 trigger");
const { onCall } = require("firebase-functions/v2/https");
const nodemailer = require("nodemailer");

// Remove these lines since we're not using them
// const { initializeApp } = require("firebase-admin/app");
// const { getStorage } = require("firebase-admin/storage");
// initializeApp();

// Create an HTTPS endpoint with CORS handling
exports.sendReadingsMail = onCall(
  {
    maxInstances: 10,
    secrets: ["EMAIL_SENDER", "EMAIL_AUTH_KEY"],
  },
  async (request) => {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_SENDER,
        pass: process.env.EMAIL_AUTH_KEY,
      },
    });

    try {
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
          consumption: parseInt(r.current) - parseInt(r.previous),
          current: parseInt(r.current),
          previous: parseInt(r.previous),
        }));

      const totalConsumption = consumptionData.reduce(
        (sum, r) => sum + r.consumption,
        0
      );
      const avgConsumption =
        consumptionData.length > 0
          ? Math.round(totalConsumption / consumptionData.length)
          : 0;
      const maxConsumption = Math.max(
        ...consumptionData.map((r) => r.consumption)
      );
      const minConsumption = Math.min(
        ...consumptionData.map((r) => r.consumption)
      );

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

      // Create the logo HTML
      const logoHtml = `
        <div class="logo">
          <img src="${logoUrl}" alt="COAB Logo" style="max-width: 200px; height: auto;">
        </div>
      `;

      // Create HTML email content with conditional logo
      const htmlContent = `
        <html>
          <head>
            <style>
              body { 
                font-family: Arial, sans-serif; 
                line-height: 1.6; 
                color: #333;
                margin: 0;
                padding: 0;
              }
              .container { 
                max-width: 800px;
                margin: 0 auto;
                padding: 20px;
              }
              .logo {
                text-align: center;
                margin-bottom: 30px;
              }
              .logo img {
                max-width: 200px;
                height: auto;
              }
              .header { 
                background-color: #1976d2;
                color: white;
                padding: 20px;
                border-radius: 8px;
                margin-bottom: 20px;
                text-align: center;
              }
              .header h2 {
                margin: 0;
                font-size: 24px;
              }
              .stats { 
                background-color: #f5f5f5;
                padding: 20px;
                border-radius: 8px;
                margin-bottom: 20px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              }
              .stats-grid {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 15px;
              }
              .stat-item { 
                background-color: white;
                padding: 15px;
                border-radius: 6px;
                border-left: 4px solid #1976d2;
              }
              .stat-label {
                font-size: 14px;
                color: #666;
                margin-bottom: 5px;
              }
              .stat-value {
                font-size: 18px;
                font-weight: bold;
                color: #1976d2;
              }
              .consumption-stats {
                margin-top: 20px;
                padding-top: 20px;
                border-top: 1px solid #ddd;
              }
              .footer { 
                margin-top: 30px;
                font-size: 0.9em;
                color: #666;
                text-align: center;
                padding-top: 20px;
                border-top: 1px solid #ddd;
              }
            </style>
          </head>
          <body>
            <div class="container">
              ${logoHtml}
              
              <div class="header">
                <h2>Lecturas de Medidores - ${readingsData.month} ${
        readingsData.year
      }</h2>
                <p>Ruta: ${readingsData.routeName}</p>
              </div>
              
              <div class="stats">
                <h3>Resumen de Lecturas</h3>
                <div class="stats-grid">
                  <div class="stat-item">
                    <div class="stat-label">Total de Medidores</div>
                    <div class="stat-value">${totalMeters}</div>
                  </div>
                  <div class="stat-item">
                    <div class="stat-label">Lecturas Completadas</div>
                    <div class="stat-value">${completedMeters}</div>
                  </div>
                  <div class="stat-item">
                    <div class="stat-label">Lecturas Omitidas</div>
                    <div class="stat-value">${skippedMeters}</div>
                  </div>
                  <div class="stat-item">
                    <div class="stat-label">Porcentaje Completado</div>
                    <div class="stat-value">${Math.round(
                      (completedMeters / totalMeters) * 100
                    )}%</div>
                  </div>
                </div>

                <div class="consumption-stats">
                  <h3>Estadísticas de Consumo</h3>
                  <div class="stats-grid">
                    <div class="stat-item">
                      <div class="stat-label">Consumo Total</div>
                      <div class="stat-value">${totalConsumption} m³</div>
                    </div>
                    <div class="stat-item">
                      <div class="stat-label">Consumo Promedio</div>
                      <div class="stat-value">${avgConsumption} m³</div>
                    </div>
                    <div class="stat-item">
                      <div class="stat-label">Consumo Máximo</div>
                      <div class="stat-value">${maxConsumption} m³</div>
                    </div>
                    <div class="stat-item">
                      <div class="stat-label">Consumo Mínimo</div>
                      <div class="stat-value">${minConsumption} m³</div>
                    </div>
                  </div>
                </div>
              </div>

              <p>Adjunto encontrará el archivo CSV con el detalle de las lecturas.</p>

              <div class="footer">
                <p>Este es un correo automático. Por favor no responder.</p>
                <p>Generado el ${new Date().toLocaleString("es-CL", {
                  timeZone: "America/Santiago",
                })}</p>
              </div>
            </div>
          </body>
        </html>
      `;

      // Create email options
      const mailOptions = {
        from: process.env.EMAIL_SENDER,
        to: [
          "matthew@temuco.com",
          "matthewjamesstanton@gmail.com",
          "aguasblancaschile@gmail.com",
        ],
        subject: `Lecturas de Medidores - ${readingsData.routeName} - ${readingsData.month} ${readingsData.year}`,
        html: htmlContent,
        text:
          `Lecturas de Medidores - ${readingsData.month} ${readingsData.year}\n\n` +
          `Ruta: ${readingsData.routeName}\n\n` +
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
          `Adjunto encontrará el archivo CSV con el detalle de las lecturas.\n\n` +
          `Este es un correo automático. Por favor no responder.\n` +
          `Generado el ${new Date().toLocaleString("es-CL", {
            timeZone: "America/Santiago",
          })}`,
        attachments: [
          {
            filename: `lecturas-${readingsData.routeName}-${readingsData.year}-${readingsData.month}.csv`,
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
      console.error("Error stack:", error.stack);
      throw new Error(error.message);
    }
  }
);

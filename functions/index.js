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

      const htmlContent = `<html><head><meta name="viewport" content="width=device-width,initial-scale=1.0"><style type="text/css">body{font-family:Arial,sans-serif;line-height:1.6;color:#333;margin:0;padding:0;background:#f8f9fa}.container{width:100%;max-width:1200px;margin:0 auto;padding:20px;box-sizing:border-box}.header{background:#1c2c64;color:#fff;padding:25px;border-radius:12px;text-align:center}.table-wrapper{width:100%;border-collapse:collapse}.table-wrapper td{vertical-align:top;padding:10px}.column{width:50%}.section-title{font-size:20px;margin-bottom:15px;border-bottom:2px solid #1c2c64;padding-bottom:5px}.card{background:#fff;border:1px solid #e9ecef;border-radius:8px;padding:15px;margin-bottom:15px;box-shadow:0 2px 4px rgba(0,0,0,0.05)}.stats-grid{display:flex;flex-wrap:wrap;gap:20px}.stat-item{flex:1;min-width:150px;background:#f8f9fa;padding:15px;border-radius:8px;text-align:center}.stat-label{font-size:14px;color:#1c2c64;margin-bottom:5px}.stat-value{font-size:22px;font-weight:bold;color:#1c2c64}@media only screen and (max-width:600px){.column{display:block;width:100% !important}}</style></head><body><div class="container">${logoHtml}<div class="header"><h2 style="margin:0;">Lecturas: ${
        readingsData.month
      } ${
        readingsData.year
      }</h2><p style="margin:10px 0 0;opacity:0.9;">Ruta: ${
        readingsData.routeId
      }</p></div><table class="table-wrapper"><tr><td class="column"><div class="section-title">Resumen de Lecturas</div><div class="card"><div class="stats-grid"><div class="stat-item"><div class="stat-label">Total de Medidores</div><div class="stat-value">${totalMeters}</div></div><div class="stat-item"><div class="stat-label">Completadas</div><div class="stat-value">${completedMeters}</div></div><div class="stat-item"><div class="stat-label">Omitidas</div><div class="stat-value">${skippedMeters}</div></div><div class="stat-item"><div class="stat-label">Porcentaje</div><div class="stat-value">${Math.round(
        (completedMeters / totalMeters) * 100
      )}%</div></div></div></div><div class="section-title">Estadísticas de Consumo</div><div class="card"><div class="stats-grid"><div class="stat-item"><div class="stat-label">Consumo Total</div><div class="stat-value">${totalConsumption} m³</div></div><div class="stat-item"><div class="stat-label">Promedio</div><div class="stat-value">${avgConsumption} m³</div></div><div class="stat-item"><div class="stat-label">Máximo</div><div class="stat-value">${maxConsumption} m³</div></div><div class="stat-item"><div class="stat-label">Mínimo</div><div class="stat-value">${minConsumption} m³</div></div></div></div></td><td class="column"><div class="section-title">Lecturas con Verificación</div><div class="card">${readingsData.emailContent
        .split("----------------------------------------")
        .filter((s) => s.trim())
        .filter((s) => s.includes("NOTA DE VERIFICACIÓN"))
        .map((s) => {
          const lines = s.trim().split("\n");
          return `<div class="card" style="margin-bottom:15px;"><div style="margin-bottom:10px;"><strong>CLIENTE:</strong> ${
            lines[0].split(": ")[1]
          }</div><div style="margin-bottom:10px;"><strong>DIRECCIÓN:</strong> ${
            lines[1].split(": ")[1]
          }</div><div style="margin-bottom:10px;"><strong>Lectura Anterior:</strong> ${
            lines[2].split(": ")[1]
          }</div><div style="margin-bottom:10px;"><strong>Lectura Actual:</strong> ${
            lines[3].split(": ")[1]
          }</div><div style="margin-bottom:10px;"><strong>CONSUMO:</strong> <span style="${
            Number(lines[4].split(": ")[1].split(" ")[0]) < 0
              ? "color:#d32f2f;"
              : ""
          }">${
            lines[4].split(": ")[1]
          }</span></div><div style="margin-top:10px;padding:10px;background:#f0f4ff;border-left:4px solid #1c2c64;"><strong>NOTA DE VERIFICACIÓN:</strong><br>${lines
            .slice(7)
            .join("<br>")}</div></div>`;
        })
        .join(
          ""
        )}</div></td></tr></table><div style="text-align:center;margin-top:30px;color:#666;font-size:13px;"><p>Adjunto encontrará el archivo CSV con el detalle de las lecturas.</p><p>Este es un correo automático. Por favor no responder.</p><p>Generado el ${new Date().toLocaleString(
        "es-CL",
        { timeZone: "America/Santiago" }
      )}</p></div></div></body></html>`;

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

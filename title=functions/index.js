console.log("Using new v2 trigger");
/* eslint-disable no-undef */
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const nodemailer = require("nodemailer");

// Configure the email transport using Firebase config
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "stantonmatthewj@gmail.com", // Replace with your email
    pass: "QAK.geg6wyv*kwx8djr", // Replace with your app password
  },
});

// Create the Cloud Function using v2 syntax
exports.sendReadingsMail = onDocumentCreated(
  { region: "us-central1" },
  "readings/{readingsId}",
  async (event) => {
    // Note: event.data is a DocumentSnapshot in v2.
    const readingsData = event.data.data();

    // Generate CSV content
    const csvRows = ["ID,Direccion,Lectura Anterior,Lectura Actual,Estado\n"];
    readingsData.readings.forEach((meter) => {
      const readings = Object.entries(meter)
        .filter(([key]) => key !== "ID")
        .sort((a, b) => b[0].localeCompare(a[0]));

      const currentReading = readings[0]?.[1] || "---";
      const lastReading = readings[1]?.[1] || "---";
      const status = currentReading === "---" ? "Omitido" : "Confirmado";

      csvRows.push(
        `${meter.ID},"${
          meter.ADDRESS || ""
        }",${lastReading},${currentReading},${status}\n`
      );
    });

    const csvContent = csvRows.join("");

    // Create email options
    const mailOptions = {
      from: "stantonmatthewj@gmail.com",
      to: "matthew@temuco.com",
      subject: `Lecturas de Medidores - ${readingsData.month} ${readingsData.year}`,
      text: "Adjunto encontrará las lecturas de medidores en formato CSV.",
      attachments: [
        {
          filename: `lecturas-${readingsData.year}-${readingsData.month}.csv`,
          content: csvContent,
        },
      ],
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log("Email sent successfully");
      return { success: true };
    } catch (error) {
      console.error("Error sending email:", error);
      return { success: false, error: error.message };
    }
  }
);

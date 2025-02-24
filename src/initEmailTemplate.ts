import { getFirestore, doc, setDoc, Firestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { enableIndexedDbPersistence } from "firebase/firestore";

type VerificationType = "lowConsumption" | "negativeConsumption" | "highConsumption";

// Helper function to generate verification card HTML
const generateVerificationCard = (type: VerificationType): string => `
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:15px;background:#fff;border:1px solid #edf2f7;border-radius:4px;">
    <tr>
      <td style="padding:15px;">
        <div style="margin-bottom:8px;font-size:13px;"><strong>CLIENTE:</strong> {ID}</div>
        <div style="margin-bottom:8px;font-size:13px;"><strong>DIRECCIÓN:</strong> {ADDRESS}</div>
        <div style="margin-bottom:8px;font-size:13px;"><strong>Lectura Anterior:</strong> {previousReading}</div>
        <div style="margin-bottom:8px;font-size:13px;"><strong>Lectura Actual:</strong> {currentReading}</div>
        ${
          type === "lowConsumption"
            ? `
          <div style="margin-bottom:8px;font-size:13px;"><strong>CONSUMO:</strong> {consumption} m³</div>
          <div style="margin-top:15px;padding:15px;background:#f8fafc;border-left:3px solid #1c2c64;font-size:12px;line-height:1.5;">
            <strong style="display:block;margin-bottom:10px;letter-spacing:0.5px;">VERIFICACIÓN DE BAJO CONSUMO</strong>
            • Atendió el cliente: {answeredDoor}<br>
            {verificationDetails}
          </div>
        `
            : type === "negativeConsumption"
            ? `
          <div style="margin-bottom:8px;font-size:13px;"><strong>CONSUMO:</strong> <span style="color:#dc2626;">{consumption} m³</span></div>
          <div style="margin-top:15px;padding:15px;background:#fef2f2;border-left:3px solid #dc2626;font-size:12px;line-height:1.5;">
            <strong style="display:block;margin-bottom:10px;letter-spacing:0.5px;">CONSUMO NEGATIVO VERIFICADO</strong>
            • Diferencia: {consumption} m³<br>
            • Verificado y confirmado por el lector
          </div>
        `
            : `
          <div style="margin-bottom:8px;font-size:13px;"><strong>CONSUMO:</strong> <span style="color:#0d47a1;">{consumption} m³</span></div>
          <div style="margin-top:15px;padding:15px;background:#f0f9ff;border-left:3px solid #0d47a1;font-size:12px;line-height:1.5;">
            <strong style="display:block;margin-bottom:10px;letter-spacing:0.5px;">ALTO CONSUMO VERIFICADO</strong>
            • Consumo promedio: {average} m³<br>
            • Porcentaje sobre promedio: {percentageAboveAverage}%<br>
            • Verificado y confirmado por el lector
          </div>
        `
        }
      </td>
    </tr>
  </table>
`;

const statsTemplate: string = `
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
                <div style="font-size:24px;font-weight:bold;color:#1c2c64;">{totalMeters}</div>
              </div>
            </td>
            <td width="25%" style="padding:10px;">
              <div style="background:#f8fafc;border:1px solid #edf2f7;border-radius:4px;padding:15px;text-align:center;">
                <div style="font-size:14px;color:#666;margin-bottom:5px;font-weight:600;">Completadas</div>
                <div style="font-size:24px;font-weight:bold;color:#1c2c64;">{completedMeters}</div>
              </div>
            </td>
            <td width="25%" style="padding:10px;">
              <div style="background:#f8fafc;border:1px solid #edf2f7;border-radius:4px;padding:15px;text-align:center;">
                <div style="font-size:14px;color:#666;margin-bottom:5px;font-weight:600;">Consumo Total</div>
                <div style="font-size:24px;font-weight:bold;color:#1c2c64;">{totalConsumption} m³</div>
              </div>
            </td>
            <td width="25%" style="padding:10px;">
              <div style="background:#f8fafc;border:1px solid #edf2f7;border-radius:4px;padding:15px;text-align:center;">
                <div style="font-size:14px;color:#666;margin-bottom:5px;font-weight:600;">Porcentaje</div>
                <div style="font-size:24px;font-weight:bold;color:#1c2c64;">{completionPercentage}%</div>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
`;

interface EmailTemplateData {
  subject: string;
  html: string;
  text: string;
  lastUpdated: Date;
  templates: {
    verificationCard: {
      lowConsumption: string;
      negativeConsumption: string;
      highConsumption: string;
    };
    stats: string;
  };
}

export const initializeEmailTemplate = async (): Promise<void> => {
  try {
    const auth = getAuth();
    if (!auth.currentUser) {
      throw new Error("User must be authenticated to initialize template");
    }

    console.log("Current user:", auth.currentUser.email);

    const firestore: Firestore = getFirestore();

    try {
      await enableIndexedDbPersistence(firestore);
    } catch (err: any) {
      if (err.code === "failed-precondition") {
        console.warn(
          "Multiple tabs open, persistence can only be enabled in one tab at a time."
        );
      } else if (err.code === "unimplemented") {
        console.warn("Browser doesn't support persistence");
      }
    }

    let retries = 3;
    while (retries > 0) {
      try {
        const templateRef = doc(firestore, "emailTemplates", "readings");
        const templateData: EmailTemplateData = {
          subject: "Lecturas: {routeId} - {month} {year}",
          html: `
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
                                  <img src="{logoUrl}" alt="COAB Logo" style="max-width:105px;height:auto;display:block;">
                                </td>
                                <td style="text-align:left;vertical-align:middle;">
                                  <h2 style="margin:0;font-size:42px;color:#2d3748;font-weight:600;line-height:1.2;">Lecturas: {month} {year}</h2>
                                  <p style="margin:5px 0 0;color:#64748b;font-size:16px;line-height:1.2;">Ruta: {routeId}</p>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>

                        <!-- Stats Section -->
                        <tr>
                          <td style="padding-top:30px;">
                            ${statsTemplate}
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
                                        <div style="font-size:18px;color:#1c2c64;border-bottom:1px solid #edf2f7;padding-bottom:12px;margin-bottom:20px;font-weight:600;letter-spacing:0.5px;">
                                          Bajo Consumo
                                        </div>
                                        ${generateVerificationCard(
                                          "lowConsumption"
                                        )}
                                      </td>
                                    </tr>
                                  </table>
                                </td>

                                <!-- Negative Consumption Column -->
                                <td width="33.33%" style="vertical-align:top;">
                                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fff;border-radius:4px;border:1px solid #edf2f7;">
                                    <tr>
                                      <td style="border-top:4px solid #dc2626;padding:20px;">
                                        <div style="font-size:18px;color:#dc2626;border-bottom:1px solid #edf2f7;padding-bottom:12px;margin-bottom:20px;font-weight:600;letter-spacing:0.5px;">
                                          Consumo Negativo
                                        </div>
                                        ${generateVerificationCard(
                                          "negativeConsumption"
                                        )}
                                      </td>
                                    </tr>
                                  </table>
                                </td>

                                <!-- High Consumption Column -->
                                <td width="33.33%" style="vertical-align:top;">
                                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fff;border-radius:4px;border:1px solid #edf2f7;">
                                    <tr>
                                      <td style="border-top:4px solid #0d47a1;padding:20px;">
                                        <div style="font-size:18px;color:#0d47a1;border-bottom:1px solid #edf2f7;padding-bottom:12px;margin-bottom:20px;font-weight:600;letter-spacing:0.5px;">
                                          Alto Consumo
                                        </div>
                                        ${generateVerificationCard(
                                          "highConsumption"
                                        )}
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
                            <p style="margin:0;color:#666;font-size:12px;">Generado el {timestamp}</p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </body>
            </html>
          `,
          text: `
            Lecturas: {routeId} - {month} {year}
            
            Resumen:
            - Total de Medidores: {totalMeters}
            - Lecturas Completadas: {completedMeters}
            - Lecturas Omitidas: {skippedMeters}
            - Porcentaje Completado: {completionPercentage}%
            
            Estadísticas de Consumo:
            - Consumo Total: {totalConsumption} m³
            - Consumo Promedio: {avgConsumption} m³
            - Consumo Máximo: {maxConsumption} m³
            - Consumo Mínimo: {minConsumption} m³

            {emailContent}

            Este es un correo automático. Por favor no responder.
            Generado el {timestamp}
          `,
          lastUpdated: new Date(),
          // Store the templates separately for easier updates
          templates: {
            verificationCard: {
              lowConsumption: generateVerificationCard("lowConsumption"),
              negativeConsumption: generateVerificationCard(
                "negativeConsumption"
              ),
              highConsumption: generateVerificationCard("highConsumption"),
            },
            stats: statsTemplate,
          },
        };
        
        await setDoc(templateRef, templateData);

        console.log("Email template initialized successfully");
        break;
      } catch (error) {
        retries--;
        if (retries === 0) throw error;
        console.warn(
          `Template write failed, retrying... (${retries} attempts left)`
        );
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  } catch (error) {
    console.error("Failed to initialize email template:", error);
    throw error;
  }
};
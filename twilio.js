const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const pdfParse = require("pdf-parse"); // For PDF processing
const sharp = require("sharp"); // For image processing
const twilio = require("twilio");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use("/*", cors());
app.use(bodyParser.urlencoded({ extended: false }));
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = require("twilio")(accountSid, authToken);

// Endpoint to handle incoming messages

app.post("/whatsapp-webhook", async (req, res) => {
  const incomingMessage = req.body.Body;
  const fromNumber = req.body.From;
  const numMedia = req.body.NumMedia;

  let responseMessage = `You said: test-api-2 ${incomingMessage}`;

  // Check if there is any media
  if (numMedia > 0) {
    responseMessage += "\nYou sent the following media:";

    for (let i = 0; i < numMedia; i++) {
      const mediaUrl = req.body[`MediaUrl${i}`];
      const mediaContentType = req.body[`MediaContentType${i}`];

      responseMessage += `\nMedia ${
        i + 1
      }: ${mediaUrl} (Type: ${mediaContentType})`;

      try {
        const mediaResponse = await axios.get(mediaUrl, {
          headers: {
            Authorization: `Basic ${Buffer.from(
              `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
            ).toString("base64")}`,
          },
          responseType: "arraybuffer",
        });

        const mediaData = mediaResponse.data;

        // Handle PDF files
        if (mediaContentType === "application/pdf") {
          const pdfData = await pdfParse(mediaData);
          // console.log(`PDF Content: ${pdfData.text}`);
          responseMessage += `\nPDF Content: ${pdfData.text.substring(
            0,
            100
          )}...`; // Show first 100 chars
        }

        // Handle Images
        else if (mediaContentType.startsWith("image/")) {
          const image = sharp(mediaData);
          const imageMetadata = await image.metadata();
          // console.log(`Image Metadata: ${JSON.stringify(imageMetadata)}`);
          responseMessage += `\nImage Dimensions: ${imageMetadata.width}x${imageMetadata.height}`;
        }
      } catch (error) {
        console.error(`Failed to download/process media: ${error}`);
        responseMessage += `\nFailed to process the media`;
      }
    }
  }

  const twiml = new twilio.twiml.MessagingResponse();
  twiml.message(responseMessage);

  res.writeHead(200, { "Content-Type": "text/xml" });
  res.end(twiml.toString());
});
app.post("/", (req, res) => {
  res.send("connected");
});
app.listen(3000, () => {
  console.log("Server is up and running on port 3000");
});

const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const pdfParse = require("pdf-parse");
const sharp = require("sharp");
const twilio = require("twilio");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use("/*", cors());
app.use(bodyParser.urlencoded({ extended: false }));

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
const client = require("twilio")(accountSid, authToken);

app.post("/whatsapp-webhook", async (req, res) => {
  const incomingMessage = req.body.Body;
  const fromNumber = req.body.From;
  const numMedia = req.body.NumMedia;

  let responseMessage = `From: ${fromNumber}\nYou said: ${incomingMessage}`;

  if (numMedia > 0) {
    responseMessage += "\nYou sent the following media:";

    for (let i = 0; i < numMedia; i++) {
      const mediaUrl = req.body[`MediaUrl${i}`];
      const mediaContentType = req.body[`MediaContentType${i}`];

      responseMessage += `\nMedia ${i + 1}: Type-> ${mediaContentType})`;

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

        if (mediaContentType === "application/pdf") {
          const pdfData = await pdfParse(mediaData);
          responseMessage += `\nPDF Content: ${pdfData.text.substring(
            0,
            100
          )}...`;
        } else if (mediaContentType.startsWith("image/")) {
          const image = sharp(mediaData);
          const imageMetadata = await image.metadata();
          responseMessage += `\nImage Dimensions: ${imageMetadata.width}x${imageMetadata.height}`;
        }
      } catch (error) {
        responseMessage += `\nFailed to process the media`;
      }
    }
  }

  if (req.body.From) {
    const userResponse = req.body.Body;
    const responseMessage = `You pressed: ${userResponse}`;

    const twiml = new twilio.twiml.MessagingResponse();
    twiml.message(responseMessage);

    res.writeHead(200, { "Content-Type": "text/xml" });
    res.end(twiml.toString());
    return;
  }

  const twiml = new twilio.twiml.MessagingResponse();
  twiml.message(responseMessage);

  res.writeHead(200, { "Content-Type": "text/xml" });
  res.end(twiml.toString());
});

app.post("/status-callback", async (req, res) => {
  const messageStatus = req.body.MessageStatus;
  const userPhoneNumber = req.body.To;
  const messageSid = req.body.MessageSid;
  let statusMessage = "";

  switch (messageStatus) {
    case "queued":
      statusMessage = "Your message is queued and will be sent shortly.";
      break;
    case "sent":
      statusMessage = "Your message has been sent.";
      break;
    case "delivered":
      statusMessage = {
        type: "template",
        template: {
          name: "interactive_buttons_template",
          language: { code: "en_US" },
          components: [
            {
              type: "body",
              text: "Your message was delivered successfully!",
            },
            {
              type: "buttons",
              buttons: [
                { type: "reply", reply: { id: "save", title: "Save" } },
                { type: "reply", reply: { id: "ignore", title: "Ignore" } },
                {
                  type: "reply",
                  reply: { id: "list_folder", title: "List Folder" },
                },
              ],
            },
          ],
        },
      };
      break;
    case "undelivered":
      statusMessage = "Your message could not be delivered. Please try again.";
      break;
    case "failed":
      statusMessage =
        "There was an error sending your message. Please contact support.";
      break;
    default:
      statusMessage = `Message status: ${messageStatus}`;
      break;
  }

  await new Promise((resolve) => setTimeout(resolve, 1000));

  if (messageStatus === "delivered") {
    client.messages
      .create({
        from: twilioPhoneNumber,
        to: userPhoneNumber,
        body: statusMessage,
      })
      .then((response) => console.log("Follow-up message sent:", response.sid))
      .catch((error) =>
        console.error("Failed to send follow-up message:", error.message)
      );
  }
  // else {
  //   client.messages
  //     .create({
  //       from: twilioPhoneNumber,
  //       to: userPhoneNumber,
  //       body: statusMessage,
  //     })
  //     .then((response) => console.log("Follow-up message sent:", response.sid))
  //     .catch((error) =>
  //       console.error("Failed to send follow-up message:", error.message)
  //     );
  // }

  res.sendStatus(200);
});

app.listen(3000, () => {
  console.log("Server is up and running on port 3000");
});

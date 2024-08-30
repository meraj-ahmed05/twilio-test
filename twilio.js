const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const pdfParse = require("pdf-parse");
const sharp = require("sharp");
const twilio = require("twilio");
const cors = require("cors");
const { saveMedia } = require("./saveMedia");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));

let count = 0;
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
const msgServiceId = process.env.MESSAGE_SERVICE_ID;
const contentSid = process.env.Content_template_SID;
const url = process.env.URL;
const client = require("twilio")(accountSid, authToken);
const myMap = new Map();

app.post("/whatsapp-webhook", async (req, res) => {
  const incomingMessage = req.body.Body;
  const fromNumber = req.body.From;
  const numMedia = req.body.NumMedia;
  let responseMessage = `From: ${fromNumber}\nYou said: ${incomingMessage}`;
  const sessionId = fromNumber; // You could use message SID or phone number as the key

  if (
    numMedia > 0 ||
    (incomingMessage && incomingMessage.includes("special text"))
  ) {
    responseMessage = "\nYou sent the following media:";
    const mediaUrl = req.body[`MediaUrl0`];
    const mediaContentType = req.body[`MediaContentType0`];
    responseMessage += `\n${mediaContentType}`;
    const mediaObj = {
      mediaUrl: mediaUrl,
      mediaContentType: mediaContentType,
    };

    if (myMap.has(sessionId)) {
      let mediaQ = myMap.get(sessionId);
      mediaQ.push(mediaObj);
    } else {
      let mediaQ = [];
      mediaQ.push(mediaObj);
      myMap.set(sessionId, mediaQ);
      try {
        setTimeout(async () => {
          const statusMessage =
            "Your media file has been recieved,suggest next action: ";
          await client.messages.create({
            contentSid: contentSid,
            contentVariables: JSON.stringify({
              1: `${count}-${statusMessage}`,
            }), // Adjust the variables as needed
            from: twilioPhoneNumber,
            messagingServiceSid: msgServiceId,
            to: fromNumber,
            body: statusMessage,
            metadata: "follow-up",
          });
          console.log("Follow-up message sent.");
        }, 3000);
      } catch (error) {
        responseMessage += `\nFailed to send Follow up message`;
      }
    }

    if (req.body.metadata === "follow-up") {
      const userResponse = req.body.Body;
      const responseMessage = `You pressed: ${userResponse}`;
      if (userResponse === "Save") {
        saveMedia(myMap, sessionId)
          .then(() => {
            myMap.delete(sessionId);
            responseMessage += "Data uploaded successfully";
          })
          .catch((error) => {
            responseMessage = "Error occurred while uploading the files";
          });
      } else {
        myMap.delete(sessionId);
      }
    }
  }

  const twiml = new twilio.twiml.MessagingResponse();
  twiml.message(responseMessage);

  res.writeHead(200, { "Content-Type": "text/xml" });
  res.end(twiml.toString());
});

app.post("/status-callback", async (req, res) => {
  count++;
  const messageStatus = req.body.MessageStatus;
  const userPhoneNumber = req.body.To;
  const messageSid = req.body.MessageSid;
  const sessionId = userPhoneNumber;
  let statusMessage = "";

  switch (messageStatus) {
    case "queued":
      statusMessage = "Your message is queued and will be sent shortly.";
      break;
    case "sent":
      statusMessage = "Your message has been sent.";
      break;
    case "delivered":
      statusMessage = "Your message was delivered successfully!";
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

  // if (messageStatus === "delivered" && myMap.has(sessionId)) {
  //   try {
  //     await client.messages.create({
  //       contentSid: contentSid,
  //       contentVariables: JSON.stringify({ 1: `${count}-${statusMessage}` }), // Adjust the variables as needed
  //       from: twilioPhoneNumber,
  //       messagingServiceSid: msgServiceId,
  //       to: userPhoneNumber,
  //       body: statusMessage,
  //       metadata: "follow-up",
  //     });
  //     myMap.delete(sessionId);

  //     console.log("Follow-up message sent.");
  //   } catch (error) {
  //     console.error("Failed to send follow-up message:", error.message);
  //   }
  // }
  res.sendStatus(200);
});

app.get("/", (req, res) => {
  console.log("server logged");
  res.status(200).send("Done");
});
function pingServer(time) {
  time = time * 60 * 1000;
  setInterval(async () => {
    try {
      const response = await axios.get(url);
    } catch (err) {
      console.log(`${err} occured while pinging server`);
    }
  }, time);
}
// This will ping server in every 14 min
pingServer(14);
app.listen(3000, () => {
  console.log("Server is up and running on port 3000");
});

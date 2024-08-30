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
const mySet = new Set();

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
      setTimeout(() => {
        const statusMessage = "Your media file has been recieved: ";
        client.messages
          .create({
            contentSid: contentSid,
            contentVariables: JSON.stringify({
              1: `${count}-${statusMessage}`,
            }),
            from: twilioPhoneNumber,
            messagingServiceSid: msgServiceId,
            to: fromNumber,
            body: statusMessage,
          })
          .then(() => {
            mySet.add(sessionId);
            console.log("Follow-up message sent.");
          })
          .catch(() => {
            responseMessage += `\nFailed to send Follow up message`;
          });
      }, 3000);
    }
  }

  if (incomingMessage === "Save" && mySet.has(sessionId)) {
    console.log("entered follow up");
    const userResponse = req.body.Body;
    responseMessage = `You pressed: ${userResponse}`;
    saveMedia(myMap, sessionId)
      .then(() => {
        myMap.delete(sessionId);
        mySet.delete(sessionId);
        responseMessage += "Data uploaded successfully";
      })
      .catch((error) => {
        responseMessage = "Error occurred while uploading the files";
      });
  } else if (
    (incomingMessage === "Ignore" || incomingMessage === "List Folder") &&
    mySet.has(sessionId)
  ) {
    myMap.delete(sessionId);
    mySet.delete(sessionId);
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
  const sessionId = userPhoneNumber;
  let statusMessage = "";
  // typesOfmessageStatus = ["queued", "sent", "delivered", "undelivered", "failed"];

  if (messageStatus === "failed" && myMap.has(sessionId)) {
    myMap.delete(sessionId);
    console.log(`${sessionId} has been deleted from map`);
  }
  if (messageStatus === "failed" && mySet.has(sessionId)) {
    mySet.delete(sessionId);
    console.log(`${sessionId} has been deleted from set`);
  }
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

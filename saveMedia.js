const axios = require("axios");
const twilio = require("twilio");
require("dotenv").config();
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
const client = twilio(accountSid, authToken);

async function saveMedia(myMap, sessionId) {
  let mediaQ = myMap.get(sessionId);
  let n = mediaQ.length;
  let responseMessage = "\nDownloaded the following media:";
  for (let i = 0; i < n; i++) {
    const mediaUrl = mediaQ[i].mediaUrl;
    const mediaContentType = mediaQ[i].mediaContentType;
    try {
      const mediaResponse = await axios.get(mediaUrl, {
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
          ).toString("base64")}`,
        },
        responseType: "arraybuffer",
      });
      responseMessage += `\n${i}:${mediaContentType}`;
      const mediaData = mediaResponse.data;
    } catch (error) {
      responseMessage += `Error while downloading mediaUrl: ${mediaContentType} `;
      console.error(`Failed to download media: ${error.message}`);
    }
  }
  createMessage(responseMessage, sessionId);
}

async function createMessage(responseMessage, sessionId) {
  try {
    const message = await client.messages.create({
      from: twilioPhoneNumber,
      body: responseMessage,
      to: sessionId,
    });
    console.log(`Message sent to ${sessionId}`);
  } catch (error) {
    console.error(`Failed to send message: ${error.message}`);
  }
}
module.exports = { saveMedia };

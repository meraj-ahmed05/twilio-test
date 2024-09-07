const twilio = require("twilio");
const axios = require("axios");
const { uploadMedia } = require("./firestoreUpload");

require("dotenv").config();
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
const contentSid = process.env.Content_template_SID_TEXT;

const client = twilio(accountSid, authToken);

async function saveMedia(myMap, sessionId) {
  let mediaQ = myMap.get(sessionId);
  let n = mediaQ.length;
  let responseMessage = "\nDownloaded the following media:";
  let promises = [];

  for (let i = 0; i < n; i++) {
    const mediaUrl = mediaQ[i].mediaUrl;
    const mediaContentType = mediaQ[i].mediaContentType;

    promises.push(
      axios
        .get(mediaUrl, {
          headers: {
            Authorization: `Basic ${Buffer.from(
              `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
            ).toString("base64")}`,
          },
          responseType: "arraybuffer",
        })
        .then(async (mediaResponse) => {
          const mediaData = mediaResponse.data;
          const downloadURL = await uploadMedia(mediaData, mediaContentType);
          responseMessage += `\n${i}:${mediaContentType}: ${downloadURL}`;
        })
        .catch((error) => {
          responseMessage = ` Error while downloading mediaUrl: ${mediaContentType} `;
          console.error(`Failed to download media: ${error.message}`);
        })
    );
  }

  try {
    await Promise.all(promises);
    await createMessage(responseMessage, sessionId);
  } catch (error) {
    console.error(`Failed during processing: ${error.message}`);
  }
}

async function createMessage(responseMessage, userPhoneNumber) {
  try {
    await client.messages.create({
      contentSid: contentSid,
      contentVariables: JSON.stringify({ 1: responseMessage }),
      from: twilioPhoneNumber,
      to: userPhoneNumber,
    });
  } catch (error) {
    console.error(`Failed to send message: ${error.message}`);
  }
}

module.exports = { saveMedia };

const { initializeApp } = require("firebase/app");
const {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
} = require("firebase/storage");
const { firebaseConfig } = require("./config");
require("dotenv").config();

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const storage = getStorage(app);

async function uploadMedia(file, contentType) {
  let pathFolder = contentType.split("/")[0];
  const id = Math.random() * 10000000;
  const metadata = {
    contentType: contentType,
  };

  return new Promise(async (resolve, reject) => {
    const storageRef = ref(storage, pathFolder);
    const uploadTask = uploadBytesResumable(storageRef, file, metadata);
    console.log(`pathfolder: ${storageRef}+${pathFolder}:`);

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const progress =
          (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        console.log("Upload is " + progress + "% done");
        switch (snapshot.state) {
          case "paused":
            console.log("Upload is paused");
            break;
          case "running":
            console.log("Upload is running");
            break;
        }
      },
      (error) => {
        console.error("Upload error:", error);
        reject(error);
      },
      async () => {
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          console.log("File available at", downloadURL);
          resolve(downloadURL);
        } catch (error) {
          console.error("Error getting download URL:", error);
          reject(error);
        }
      }
    );
  });
}
module.exports = { uploadMedia };

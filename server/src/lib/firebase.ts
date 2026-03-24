import admin from "firebase-admin";

var serviceAccount = require("../../credentials.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

async function sendNotification(
  token: string,
  title: string,
  body: string,
  payload: any = {},
  imgUrl: string | null = null
) {
  try {
    if (!token) throw new Error("Token not found");
    if (!title) throw new Error("Title not found");
    if (!body) throw new Error("Body not found");

    // Create the base message object
    const message: any = {
      token,
      android: {
        notification: {
          channelId: "elite-kp-jewellery",
          sound: "noti",
        },
        priority: "high",
      },
      data: {
        title,
        body,
        ...payload,
      },
      notification: {
        title,
        body,
      },
    };

    // Optionally add imageUrl if it is provided
    if (imgUrl) {
      message.android.notification.imageUrl = imgUrl;
      message.notification.imageUrl = imgUrl;
    }

    await admin.messaging().send(message);

    return true;
  } catch (error) {
    console.log(error);
    return false;
  }
}

export { admin, sendNotification };

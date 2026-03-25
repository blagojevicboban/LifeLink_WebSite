importScripts("https://www.gstatic.com/firebasejs/11.0.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.0.1/firebase-messaging-compat.js");

firebase.initializeApp({
    apiKey: "AIzaSyAGZKMBP6u6dPr3_VKvqi-klEi-8XIl8_0",
    authDomain: "lifelink-a3581.firebaseapp.com",
    projectId: "lifelink-a3581",
    storageBucket: "lifelink-a3581.firebasestorage.app",
    messagingSenderId: "384903714979",
    appId: "1:384903714979:web:35581896791e3e518dc716"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    console.log('[sw.js] Primljena background poruka: ', payload);
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: '../img/lifelink_logo.png'
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});

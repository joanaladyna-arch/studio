/* Service worker des notifications push Lectoria (FCM).
   La configuration Firebase arrive dans l'adresse d'enregistrement (voir lib/push-client.ts).
   Quand le message contient un champ "notification", FCM l'affiche tout seul et ouvre
   le lien au clic (webpush.fcmOptions.link) : rien d'autre à faire ici. */
importScripts("https://www.gstatic.com/firebasejs/11.9.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.9.1/firebase-messaging-compat.js");

const p = new URL(self.location.href).searchParams;
firebase.initializeApp({
  apiKey: p.get("apiKey"),
  authDomain: p.get("authDomain"),
  projectId: p.get("projectId"),
  storageBucket: p.get("storageBucket"),
  messagingSenderId: p.get("messagingSenderId"),
  appId: p.get("appId"),
});
firebase.messaging();

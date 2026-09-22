# Push Notifications for the Scholar App — Design

> Status: proposed, awaiting sign-off before implementation.

## 1. Goal

A scholar should be notified about things the office does — a new
announcement, a grade decision, an upcoming event, a change to their standing
— **without having the app open**. Today they only find out by launching it.

**Expectation to set up front:** a phone that is genuinely powered off receives
nothing at that moment. Firebase holds the message and delivers it when the
phone next comes online. "App closed" is solved completely; "phone off" means
"arrives on power-up".

## 2. What exists today

- `flutter_local_notifications` only — there is **no `firebase_messaging`** in
  `pubspec.yaml`, and **no `android/app/google-services.json`**, so the Android
  app is not registered for Firebase Cloud Messaging at all.
- `AnnouncementNotificationService` fires a local OS notification when the
  running app notices a new announcement. Its own doc comment already says
  this "is NOT true push … a scholar who has quit the app won't be notified
  until they reopen it."
- `EventReminderService` is better than it looks: on Android it uses an
  OS-scheduled notification, so a reminder for an event the app has **already
  seen** does fire while the app is closed. The gap is events created or
  changed after the scholar last opened the app.
- Android application id is `com.example.iskonnect2` (scanner:
  `com.example.qr_scanner`).

## 3. Constraints

- **The Firebase project is on the Spark plan**, so Cloud Functions cannot be
  deployed — the usual "Firestore trigger sends a push" approach is
  unavailable.
- There is already a plain Node server for exactly this reason:
  `backend/functions/local-form-server.js`, deployable on Render
  (`render.yaml`), and it already holds `firebase-admin` credentials in the
  same style the scholar import uses.
- The admin panel authenticates to that server with a shared secret header
  (`x-admin-key`), because it signs in to Firebase anonymously and has no admin
  claim. Push sending reuses that pattern.
- iOS is out of scope: it needs an APNs key and a Mac to build.

## 4. Architecture

```
Admin panel  --POST /sendPush (x-admin-key)-->  Node server (Render)
                                                      |
                                              firebase-admin
                                                      |
                                          FCM  -->  scholar's phone
                                                   (app closed or open)
Render daily cron --> event reminders for tomorrow --> /sendPush
```

Three pieces:

### 4.1 App: register for push and store a token

- Add `firebase_messaging`. On login (and on `onTokenRefresh`), request
  permission — Android 13+ requires the `POST_NOTIFICATIONS` runtime
  permission — and write the token to the scholar's own user document.
- Storage shape on `users/{uid}`:
  ```js
  fcmTokens: { "<token>": { platform: "android", updatedAt: "<ISO>" } }
  ```
  A map keyed by token, not an array: a scholar may use two devices, and a map
  makes add/remove idempotent without read-modify-write races.
- On logout, delete that device's token so a shared phone stops receiving the
  previous scholar's notifications.
- A foreground message still shows through the existing
  `flutter_local_notifications` path, so behaviour with the app open is
  unchanged.

### 4.2 Server: one sending endpoint

`POST /sendPush` on `local-form-server.js`, guarded by `x-admin-key`:

```js
{ audience: { uids: ["..."] } | { allActiveScholars: true },
  title: "...", body: "...", data: { route: "/announcements", id: "..." } }
```

- Resolves `fcmTokens` from the targeted user docs, sends with
  `admin.messaging().sendEachForMulticast`, and **prunes tokens FCM reports as
  unregistered** so dead devices don't accumulate.
- `data.route` lets a tap open the right screen.
- Returns per-token results so a failure is visible rather than silent.

### 4.3 Triggers (all four confirmed)

| Event | Fired from | Audience |
|---|---|---|
| New announcement | `AppContext.addAnnouncement` | all active scholars |
| Grades confirmed / revision requested | `AppContext.setGradesEvaluation` | that scholar |
| Status change (on hold, restored, terminated, graduated) | the status sweeps and manual actions | that scholar |
| Upcoming event reminder | **Render daily cron**, not the admin panel | scholars with the event's term |

The event reminder belongs on the cron (the repo already runs
`scheduled-backup.js` daily) because it must fire whether or not an admin has
the panel open — the same reason the counting sweeps misbehaved when a browser
tab was stale.

## 5. What only you can do (Firebase console)

1. **Project settings → Your apps → Add app → Android**, package name
   `com.example.iskonnect2`.
2. Download **`google-services.json`** into `scholar-ui11/android/app/`.
3. Confirm **Cloud Messaging** is enabled for the project.

Until step 2 exists, the app compiles but no device can obtain a token.

**Worth deciding now:** `com.example.iskonnect2` is a placeholder id. Changing
it later (e.g. to `ph.gov.calapan.ced.iskonnect`) means re-registering the app
and reinstalling every copy, so if it is ever going to change, change it before
push is wired up.

## 6. Web push (deferred)

The hosted scholar site could also receive push, but it needs a VAPID key pair
and a `firebase-messaging-sw.js` service worker, and browser notifications are
a weaker channel for this audience. Recommend shipping Android first.

## 7. Risks and edge cases

- **Dead tokens** accumulate as scholars reinstall; the prune step above is not
  optional.
- **Doze / battery optimisation** can delay a normal-priority message. Use
  high priority only for genuinely time-sensitive items (status change, event
  reminder), otherwise Android may throttle the app.
- **Duplicate notification with the app open**: the foreground handler must not
  show both an FCM notification and the existing local one.
- **Secret handling**: `x-admin-key` is currently a hardcoded default. Anyone
  who reads the admin bundle can send a push to every scholar. This should move
  to an environment variable before the endpoint goes live, and is worth doing
  regardless of push (the import endpoint has the same exposure).

## 8. Testing

- Send a push from the server to one known token with the app **force-closed**;
  confirm the phone shows it and tapping opens the right screen.
- Reinstall the app and confirm the stale token is pruned rather than erroring.
- Two devices for one scholar: both receive.
- Log out on device A: A stops receiving, B continues.
- Turn the phone off, send, power on: message arrives on reconnect.

Device testing is mandatory here — none of this can be verified from a
development machine alone.

## 9. Estimate

Roughly: app-side token plumbing (small), server endpoint (small), four
triggers (medium, spread across the admin panel), cron reminder (small), plus
device testing. The console steps in §5 block everything else.

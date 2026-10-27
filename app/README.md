# The Daily Brief

A phone-first PWA built from the Claude Design handoff in `../project/Daily Brief.dc.html`, styled with the Organic design system (`src/styles/organic.css` is a copy of the system's `styles.css`).

- **Brief**: today's calendar events and your planned tasks on one timeline, with a NOW marker, your day streak, the gym goal for the week, and a chip for the next deadline.
- **Morning**: give each task a time (±30 min), add or remove tasks, then commit. Once you commit, you get a firm reminder 15 minutes before each task.
- **Evening**: pick a mood, tick off what got done, and write one line about the day. Closing the day extends your streak. Anything unfinished carries into tomorrow's plan as "Carried from Mon".
- **Settings**: add, toggle or remove iCal calendars, set the check-in times (default 07:30 and 21:00), switch light or dark, see notification previews, and turn on notifications.

## Run it

```sh
npm install
npm run dev        # http://localhost:5173, with the /api/ical proxy
npm test           # parser and day-lifecycle tests
npm run build && npm start   # production: serves dist/ and /api/ical on $PORT (default 8080)
```

To install it on a phone, open the deployed URL and use **Add to Home Screen**. Notifications need HTTPS.

## Calendars

Calendars are iCal (`.ics`) feeds. The app fetches them through `/api/ical?url=…` (`ical-proxy.mjs`), because most calendar hosts don't send CORS headers. The proxy accepts only http(s) URLs that return a `VCALENDAR` and refuses private and localhost addresses. Events from yesterday to two weeks ahead are expanded, including recurrences, moved occurrences and cancellations, and cached in `localStorage`, so the brief still works offline.

- **College**: the TU Dublin timetable link is preconfigured. When a feed's last event is in the past, Settings shows "feed ends …".
- **Work (Google)**: Google Calendar → Settings → your calendar → Integrate calendar → *Secret address in iCal format*. Paste it under Settings → Add a calendar.
- **Outlook**: Settings → Calendar → Shared calendars → Publish a calendar → the ICS link.

## Limits

- Reminders fire while the app is open or suspended in the background. Push notifications for a closed app would need a push server, which isn't built.
- All data is stored on the device in `localStorage`. Nothing syncs between devices.

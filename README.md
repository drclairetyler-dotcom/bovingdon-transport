# Bovingdon Transport Checker

Mobile-first train checker: Bovingdon → London.
Compares **National Rail from Hemel Hempstead** vs **Met line from Chalfont & Latimer**.

## Features
- Next 5 departures from each station
- Live delay / cancellation status
- Disruption & strike banners
- "Leave Bovingdon by" time with drive reminder
- Tap-to-open Google Maps directions
- Recommended route highlighted
- Auto-refreshes every 60 seconds
- Works without API keys (demo mode with realistic timetable data)

---

## Setup

### 1. Get your API keys

**Transport API (National Rail)**
1. Go to https://www.transportapi.com
2. Sign up for a free account
3. Copy your **App ID** and **App Key** from the dashboard
   - Free tier includes 1,000 requests/day — plenty for personal use

**TfL API (Metropolitan line)**
1. Go to https://api-portal.tfl.gov.uk
2. Register for a free account
3. Create an application and copy your **App Key**
   - Completely free, generous limits

---

### 2. Deploy to Netlify

**Option A — Netlify CLI (recommended)**
```bash
npm install -g netlify-cli
cd bovingdon-transport
netlify login
netlify init        # link to a new site
netlify env:set TRANSPORT_API_ID   your_app_id_here
netlify env:set TRANSPORT_API_KEY  your_app_key_here
netlify env:set TFL_API_KEY        your_tfl_key_here
netlify deploy --prod
```

**Option B — Netlify dashboard**
1. Push this folder to a GitHub repo
2. Go to https://app.netlify.com → Add new site → Import from Git
3. Build settings:
   - Publish directory: `public`
   - Functions directory: `netlify/functions`
4. Go to Site settings → Environment variables and add:
   - `TRANSPORT_API_ID` = your Transport API App ID
   - `TRANSPORT_API_KEY` = your Transport API App Key
   - `TFL_API_KEY` = your TfL App Key
5. Trigger a redeploy

---

### 3. Use it

Bookmark the Netlify URL on your phone's home screen:
- iOS: Safari → Share → Add to Home Screen
- Android: Chrome → Menu → Add to Home Screen

---

## Without API keys

The app runs in **demo mode** automatically if the API keys aren't set.
It shows realistic illustrative times based on real timetable patterns.
A small notice is shown at the top when in demo mode.

---

## File structure

```
bovingdon-transport/
├── public/
│   └── index.html          ← the entire frontend
├── netlify/
│   └── functions/
│       └── trains.js       ← serverless API proxy
├── netlify.toml            ← Netlify config
├── package.json
└── README.md
```

---

## Customising

All drive times and journey times are at the top of `public/index.html`:

```js
const DRIVE_TO_HEMEL = 18;     // mins from Bovingdon
const DRIVE_TO_CHALFONT = 22;  // mins from Bovingdon
const RAIL_JOURNEY = 30;       // Hemel → Euston approx
const MET_JOURNEY = 55;        // Chalfont → Baker Street approx
```

Adjust these if you find the real times differ.

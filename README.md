# Lunch Order App

A mobile-friendly lunch ordering app: colleagues pick dishes and pay via
TnG QR (or "pay later"), admin manages the daily menu and payment status.
Backed by Firebase Firestore so data syncs across everyone's phones.

## 1. Set up Firebase (one-time, ~5 minutes)

1. Go to https://firebase.google.com → **Get started** → **Add project**.
   Free, no card required (Spark plan).
2. In the left menu: **Build → Firestore Database → Create database**.
   Pick a region close to you (e.g. `asia-southeast1`), start in
   **test mode** for now.
3. Go to **Firestore Database → Rules**, delete everything there, and
   paste in the contents of `firestore.rules` from this project. Click
   **Publish**.
4. Click the ⚙️ gear icon → **Project settings** → scroll to
   **Your apps** → click the **`</>`** (web) icon → give it any
   nickname → **Register app**. Firebase shows you a `firebaseConfig`
   object.
5. Open `src/firebase-config.js` in this project and replace the
   placeholder values with the ones Firebase gave you.

## 2. Run it locally (optional, needs Node.js)

```bash
npm install
npm run dev
```

Opens at http://localhost:5173

## 3. Deploy it and get a public link

**Easiest — no terminal needed:**
1. Create a free GitHub account if you don't have one, and a new
   repository.
2. Upload every file in this project to that repository (GitHub's
   "Add file → Upload files" button in the browser works fine — drag
   the whole folder in).
3. Go to https://vercel.com → sign up free with GitHub → **Add New
   Project** → import the repository you just created.
4. Vercel auto-detects this as a Vite project and deploys it. You'll
   get a live `https://your-project.vercel.app` link in about a
   minute. Every time you update files on GitHub, it redeploys
   automatically.

**Alternative — if you have Node.js / a terminal:**

```bash
npm run build
```

This creates a `dist/` folder of static files. Drag that folder into
https://app.netlify.com/drop for an instant live link.

## Notes

- The admin passcode is a light gate, not bank-grade security — see
  the comments in `firestore.rules` for details and an upgrade path.
- The TnG QR image is stored as a base64 string directly in Firestore
  (rather than Firebase Storage, which now requires a paid plan) — no
  extra setup needed for this.

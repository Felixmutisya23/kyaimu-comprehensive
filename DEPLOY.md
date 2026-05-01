# EduManage Pro — Deployment Guide

## Running Locally

```bash
npm install
npm start
# Open: http://localhost:5173
```

## Deploy to GitHub Pages (Free — Works for Every School)

### First Time
1. Create a GitHub account (free) at github.com
2. Click "New Repository" → name it e.g. `greenview-primary`
3. Upload/push this project to that repo

### Push Code
```bash
cd edumanage-pro
git init
git add .
git commit -m "Initial EduManage Pro"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/REPO_NAME.git
git push -u origin main
```

### Enable GitHub Pages
1. Open your repo on GitHub
2. Go to **Settings → Pages**
3. Under "Build and deployment" → Source: **GitHub Actions**
4. Wait ~2 minutes — your site is live!

### Your School URL
```
https://YOUR_USERNAME.github.io/REPO_NAME/
```

### For Multiple Schools
- Fork/duplicate the repo for each school
- Each school gets their own URL
- Each school's data is in their own browser — never mixed

### Pushing Updates
```bash
git add .
git commit -m "Bug fix / new feature"
git push
# All schools get the update automatically on next browser refresh
# Their data is NEVER affected — only app code updates
```

---

## Required Configuration

### 1. InstaSend (M-Pesa Payments)
In `src/components/LicenseSystem.jsx`, replace:
```js
const INSTASEND_PUBLIC_KEY = 'ISPubKey_live_your_key_here';
```
With your actual InstaSend public key from instasend.io.

Also switch the API URLs from `sandbox.instasend.io` to `app.instasend.io` for live payments.

### 2. Africa's Talking (SMS to Parents)
Configure in the app itself: **Parent Messaging → SMS Setup**
- Username: your Africa's Talking username
- API Key: from africastalking.com dashboard
- Sender ID: your school name (max 11 chars)

### 3. Developer Token Password
In `src/components/LicenseSystem.jsx`, change:
```js
const DEV_PASSWORD = 'devEduManage2025!';
```
To a secret password only you know.

---

## Data & Backup
- All data stored in browser localStorage (offline-first)
- Never lost during app updates
- Schools can **Settings → Download Backup** (.json file)
- Restore on new computer: **Settings → Restore from Backup**

---

## Default Login
```
Email: principal@school.ac.ke
Password: admin123
```
Change in Settings → School Identity after first login.

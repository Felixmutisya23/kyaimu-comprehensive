# EduManage Pro 🎓

A complete school management system for Kenyan primary & junior secondary schools. Works **offline and online**, data is never lost, and runs forever on GitHub Pages — free for every school.

---

## 🚀 New Features Added

### 📅 Term Management
- Admin sets **start and end dates** for each term
- System automatically shows current term on every page
- Term badge in header — always know if you're in session
- When a term ends, subscription for next term is prompted

### 💰 Fee Structure Per Class
- Admin defines fee types (Tuition, Sports, Remedials, etc.)
- Set **amounts per class, per term, per year**
- When adding a student → **fees auto-populate** from the fee structure
- **Print Fee Structure** for any class or all classes at once

### 📊 Detailed Student Fee Report
Each student's fee statement shows:
- **Tuition Fee** → Expected: KES 8,000 | Paid: KES 5,000 | Balance: KES 3,000
- **Sports Fee** → Expected: KES 1,000 | Paid: KES 1,000 | ✓ CLEARED
- **Remedials** → Expected: KES 500 | Paid: KES 0 | Balance: KES 500
- Grand total owed / cleared

### 📊 Subject Performance Report
- Subjects ranked **best → weakest** (on-screen + printable)
- Class average, highest score, lowest score, pass rate per subject
- Student scores sorted by best performing subject
- Print "Subject Performance Analysis" button in Exams

### 📱 Parent Messaging — One Click
- **Broadcast**: Type message → click → ALL parents receive SMS
- **Results**: Click → every parent receives their child's results individually
- Uses Africa's Talking SMS (best for Kenya)
- No API key? Prints a list for manual sending
- Message logs for records

### 🔒 Subscription System
- **KES 100 per student per term** (auto-calculated)
- Payment via **InstaSend (M-Pesa STK push)**
- System **detects payment automatically** — unlocks immediately
- If unpaid → **Read-Only mode** (all data safe, no writing)
- **Token system** for developer:
  - Generate token with expiry date (e.g. 30 days, 90 days)
  - School enters token → system opens instantly
  - Format: `EDU-ABCD-20251231-0500-XXXX`

---

## 🏫 Running Many Schools — Free Forever

### How It Works
- Each school gets a **free GitHub Pages URL**
- Data lives in **their own browser** (localStorage)
- Each school's data is completely isolated — never mixing
- You push code once → **all schools get the update automatically**

### Deploy for a School (5 minutes)
```bash
# 1. Fork or clone this repo
git clone https://github.com/you/edumanage-pro.git
cd edumanage-pro

# 2. Install & build
npm install
npm run build

# 3. Push to GitHub
git remote add origin https://github.com/you/school-name.git
git push -u origin main

# 4. Enable GitHub Pages in repo Settings → Pages → GitHub Actions
# School URL: https://you.github.io/school-name/
```

### Push Updates to All Schools Without Disturbing Them
```bash
# Fix a bug or add a feature
git add .
git commit -m "Fix fee balance calculation"
git push origin main
# GitHub Actions deploys in ~2 minutes
# Schools get update on next refresh
# Their data is NEVER touched — only the app code updates
```

### One Repo, All Schools — Zero Cost
Since data is in each school's browser, you can even give all schools the same URL. They each have their own data automatically.

---

## ⚙️ Setup

```bash
npm install    # Install dependencies
npm start      # Run locally at localhost:5173
npm run build  # Build for production
```

**Default login:**
```
Email: principal@school.ac.ke
Password: admin123
```

---

## 💳 InstaSend Setup

1. Sign up at instasend.io → get your ISPubKey_live_... key
2. In `src/components/LicenseSystem.jsx` replace:
   ```js
   const INSTASEND_PUBLIC_KEY = 'ISPubKey_live_your_key_here';
   ```
3. Also update the API URL from sandbox to live:
   ```
   https://app.instasend.io/api/v1/...  (live)
   https://sandbox.instasend.io/api/v1/ (sandbox/testing)
   ```

---

## 🔑 Token Generator

In **Settings → Developer: Generate Token** (password protected):
1. Set expiry date (e.g. 90 days = one term)
2. Set max students
3. Enter developer password (change `DEV_PASSWORD` in LicenseSystem.jsx)
4. Copy generated token → send to school via WhatsApp/SMS
5. School enters it → system unlocks immediately

---

## 📱 SMS / Africa's Talking Setup

1. Sign up at africastalking.com
2. In the app: **Parent Messaging → SMS Setup**
3. Enter your username and API key
4. Test with "sandbox" username first
5. Switch to live credentials when ready

---

## 📄 Default Login
Email: `principal@school.ac.ke`  
Password: `admin123`  
Change in Settings after first login.

# Abu Dhabi Warehouse Tracker — Vercel Deployment Guide

## 🚀 Quick Deploy Steps

### Step 1 — Run SQL in Supabase
1. Go to your Supabase project → **SQL Editor**
2. Copy the entire contents of `supabase-schema.sql`
3. Paste and click **Run**
4. You should see: "Success. No rows returned"

### Step 2 — Push to GitHub
```bash
# In your terminal / command prompt:
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/abudhabi-warehouse.git
git push -u origin main
```

### Step 3 — Deploy to Vercel
1. Go to [vercel.com](https://vercel.com) → **New Project**
2. Import your GitHub repository
3. Add these **Environment Variables**:

| Name | Value |
|------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://gnrallmpablbbcrhplte.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | *(your anon key)* |
| `SUPABASE_SERVICE_KEY` | *(your service role key)* |
| `JWT_SECRET` | `abudhabi-warehouse-secret-2024-xK9mP2qR` |

4. Click **Deploy** → wait ~2 minutes

### Step 4 — Initialise Database
Once deployed, open your browser and call:
```
POST https://your-app.vercel.app/api/init
```
You can use [Postman](https://postman.com) or run this in browser console:
```js
fetch('/api/init', { method: 'POST' }).then(r => r.json()).then(console.log)
```
This seeds all 23 products and creates default users.

---

## 🔐 Default Credentials
| Username | Password | Role |
|----------|----------|------|
| `admin` | `admin123` | Admin |
| `employee01` | `emp123` | Employee |

**Change passwords** immediately after first login via User Management!

---

## 🛠️ Local Development
```bash
npm install
npm run dev
# App runs at http://localhost:3000
# After starting, call: POST http://localhost:3000/api/init
```

---

## 📋 Features
- ✅ Daily stock entry (inline editing, Tab navigation, auto-save)
- ✅ Monthly summary with PDF export
- ✅ Yearly overview with charts + PDF export
- ✅ Role-based access (Admin / Employee)
- ✅ Save & Close locking (employees)
- ✅ Auto carry-forward (closing → next day opening)
- ✅ User management (Admin only)
- ✅ Zero-stock highlighted in red

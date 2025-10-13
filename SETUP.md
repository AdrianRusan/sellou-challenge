# Quick Setup Guide

Follow these steps to get the PDF Parser app running locally.

## Prerequisites

- Node.js 18 or higher
- npm or yarn
- A Supabase account (free tier works fine)

## 1. Install Dependencies

```bash
npm install
```

## 2. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Choose a project name and database password
3. Wait for the project to be fully initialized (2-3 minutes)

## 3. Set Up Database Schema

### Option A: Using SQL Editor (Easiest)

1. In your Supabase dashboard, go to **SQL Editor**
2. Click **New Query**
3. Copy and paste the entire contents of `supabase/migrations/001_initial_schema.sql`
4. Click **Run** to execute the SQL

This creates:
- `pdf_parsing_jobs` table with all columns and indexes
- `pdf-uploads` storage bucket (private)
- Row Level Security policies
- Storage policies
- Automatic `updated_at` trigger

### Option B: Using Supabase CLI

```bash
# Install CLI globally (if not already installed)
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project (get project ref from dashboard URL)
supabase link --project-ref YOUR_PROJECT_REF

# Push migrations
supabase db push
```

## 4. Configure Environment Variables

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. In Supabase dashboard, go to **Project Settings > API**

3. Copy these values to your `.env.local` file:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon/public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY`

## 5. Enable Supabase Realtime (CRITICAL!)

**This step is essential for real-time progress updates to work.**

### Option A: Using Dashboard (Easiest)

1. Go to **Database > Replication** in your Supabase dashboard
2. Find the `pdf_parsing_jobs` table in the list
3. Toggle the switch to **Enable** Realtime for this table
4. Click **Save** or wait for auto-save

### Option B: Using SQL

Run this in the SQL Editor:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE pdf_parsing_jobs;
```

## 6. Deploy Edge Function

### Option A: Using Supabase CLI (Recommended)

```bash
# Install Supabase CLI globally (if not already done)
npm install -g supabase

# Login (if not already done)
supabase login

# Link your project (if not already done)
supabase link --project-ref YOUR_PROJECT_REF

# Deploy the edge function
supabase functions deploy parse-pdf
```

After deployment, you should see output like:
```
Deployed Function parse-pdf on project YOUR_PROJECT_REF
```

### Option B: Manual Deployment via Dashboard

1. In Supabase dashboard, go to **Edge Functions**
2. Click **New Function**
3. Function name: `parse-pdf`
4. Copy the entire contents of `supabase/functions/parse-pdf/index.ts`
5. Paste into the editor
6. Click **Deploy**

**Note**: Manual deployment via dashboard may not properly handle imports. CLI deployment is strongly recommended.

## 7. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 8. Test the Application

### Quick Test

1. Click **Choose File** and select a small PDF (1-10 pages)
2. Click **Upload and Parse PDF**
3. You should see:
   - Upload completes immediately
   - Status changes from PENDING → PROCESSING
   - Progress bar updates in real-time
   - Status changes to COMPLETED
   - Results automatically appear below with statistics
4. Click **Download TXT** to save extracted text
5. Click **Upload Another PDF** to test again

### Expected Behavior

- **Small PDFs (1-10 pages)**: Complete in 1-3 seconds
- **Medium PDFs (50-100 pages)**: Progress updates every 10 pages
- **Large PDFs (300+ pages)**: May take 30-60 seconds, with regular updates

## Troubleshooting

### Real-time updates not working

**Symptom**: Progress bar shows 0%, status stays on "PROCESSING" forever

**Fix**:
1. ✅ Verify Realtime is enabled: **Database > Replication > pdf_parsing_jobs**
2. Check browser console for errors (press F12)
3. Look for "Real-time update:" logs in console
4. Refresh the page after enabling Realtime

### "Failed to upload file"

**Causes**:
- Environment variables not set correctly
- Storage bucket doesn't exist
- File is not a valid PDF or exceeds 50MB

**Fix**:
1. Double-check `.env.local` values match Supabase dashboard
2. Verify bucket exists: **Storage > pdf-uploads**
3. Try with a small test PDF first

### Job stays in "PENDING" status

**Causes**:
- Edge Function not deployed
- Edge Function failed to trigger
- Service role key incorrect

**Fix**:
1. Run `supabase functions list` to verify deployment
2. Check Edge Function logs: **Edge Functions > parse-pdf > Logs**
3. Verify `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`
4. Try uploading again

### Edge Function errors

**Where to look**:
- **Edge Functions > parse-pdf > Logs** in Supabase Dashboard
- Look for red error messages with stack traces

**Common issues**:
- "getDocument is not a function" → pdfjs-serverless import issue
- "Blob not found" → Storage bucket permissions
- "Timeout" → PDF too large (>150s processing time)

## Production Deployment (Optional)

### Prerequisites

1. Ensure Edge Function is deployed to production Supabase
2. Test locally first to verify everything works

### Deploy to Vercel (Recommended)

1. **Push code to GitHub**:
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin YOUR_GITHUB_REPO_URL
git push -u origin main
```

2. **Deploy to Vercel**:
   - Go to [vercel.com](https://vercel.com)
   - Click **Import Project**
   - Select your GitHub repository
   - Configure project:
     - Framework: Next.js
     - Build Command: `npm run build`
     - Output Directory: `.next`

3. **Add Environment Variables** in Vercel:
   - Go to **Project Settings > Environment Variables**
   - Add all three variables from your `.env.local`:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - `SUPABASE_SERVICE_ROLE_KEY`
   - Apply to: **Production**, **Preview**, and **Development**

4. **Deploy**:
   - Click **Deploy**
   - Wait 1-2 minutes for deployment
   - Test with a small PDF

### Deploy to Other Platforms

**Netlify, Railway, Render, etc.**:
```bash
# Build the app
npm run build

# Environment variables required:
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# Start command
npm start
```

## Summary Checklist

Use this checklist to ensure everything is set up correctly:

- [ ] Node.js 18+ installed
- [ ] Dependencies installed (`npm install`)
- [ ] Supabase project created
- [ ] Database schema deployed (ran migration SQL)
- [ ] Storage bucket `pdf-uploads` exists
- [ ] Realtime enabled for `pdf_parsing_jobs` table
- [ ] `.env.local` file created with all 3 environment variables
- [ ] Edge Function `parse-pdf` deployed
- [ ] Development server runs without errors (`npm run dev`)
- [ ] Uploaded a test PDF successfully
- [ ] Real-time progress updates working
- [ ] Results display correctly
- [ ] Download TXT button works

## Next Steps

Once everything is working:

- **Customize UI**: Edit components in `components/` folder
- **Adjust Limits**: Change max file size in `app/actions/pdf-actions.ts:20`
- **Add Authentication**: Implement Supabase Auth for multi-user support
- **Add Features**:
  - Job history
  - Search within extracted text
  - Export to JSON
  - Pagination for large texts

## Need Help?

- **Detailed Docs**: Check [README.md](./README.md)
- **Architecture**: See [CLAUDE.md](./CLAUDE.md)
- **Supabase Docs**: [supabase.com/docs](https://supabase.com/docs)
- **Next.js Docs**: [nextjs.org/docs](https://nextjs.org/docs)

## Support

If you encounter issues:
1. Check the Troubleshooting section above
2. Review Edge Function logs in Supabase Dashboard
3. Check browser console (F12) for client-side errors
4. Ensure all environment variables are set correctly

# PDF Parser App

A Next.js 15 application for parsing PDF files with real-time progress tracking using Supabase. Features an intelligent **hybrid processing architecture** that automatically optimizes for speed or reliability based on document size.

## Features

### Core Capabilities
- 📤 Upload PDF files up to 50MB
- ⚡ **Smart Processing**: Automatically chooses optimal method
  - Fast Mode (< 125 pages): 30-60 second processing
  - Queue Mode (≥ 125 pages): Distributed processing for unlimited scalability
- 📊 Real-time parsing progress tracking via Supabase Realtime
- 📝 Extract text and metadata from PDFs of any size
- 💾 Download extracted text as TXT files
- ✨ Beautiful, responsive UI with gradient designs
- 🚀 Handles massive PDFs (tested with 600+ pages)
- 🔄 Automatic progress updates with live UI feedback
- 🛡️ Error handling and recovery (failed pages don't block completion)
- ⚙️ Configurable processing threshold (default: 125 pages)

### Architecture Highlights
- **Hybrid Processing System**: Dual-mode architecture for optimal performance
- **Queue-Based Processing**: PostgreSQL queue (pgmq) for large documents
- **PDF Caching**: Worker caches PDFs in memory (3-4x speedup)
- **Atomic Updates**: Database functions ensure data consistency
- **Cron Worker**: 10-second interval for near-real-time processing
- **Fault Tolerant**: Individual page failures don't crash the job

## Tech Stack

- **Next.js 15** with App Router and Server Actions
- **React 19** with Client/Server Components
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **Supabase** (Database, Storage, Realtime, Edge Functions, Cron)
- **npm:unpdf** (PDF.js v5.4.149) for PDF processing in Deno Edge Functions
- **pgmq** (PostgreSQL Message Queue) for distributed task processing

## Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account ([supabase.com](https://supabase.com))
- Supabase CLI (optional but recommended)

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Supabase Project

#### Option A: Using Supabase CLI (Recommended)

```bash
# Install Supabase CLI (if not already installed)
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project (you'll need your project reference ID)
supabase link --project-ref your-project-ref

# Push database migrations (creates tables, buckets, and policies)
supabase db push

# Deploy Edge Function
supabase functions deploy parse-pdf
```

#### Option B: Manual Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the migration script from `supabase/migrations/001_initial_schema.sql`
3. Go to **Database > Replication** and enable Realtime for the `pdf_parsing_jobs` table
4. Go to **Edge Functions** and create a new function:
   - Name: `parse-pdf`
   - Copy code from `supabase/functions/parse-pdf/index.ts`
   - Deploy the function

### 3. Configure Environment Variables

Create a `.env.local` file in the root directory:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Get these values from your Supabase project:
- Navigate to **Project Settings > API**
- Copy the **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- Copy the **anon/public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Copy the **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` (keep this secret!)

### 4. Enable Supabase Realtime (Critical!)

For real-time progress updates to work:

1. Go to **Database > Replication** in Supabase Dashboard
2. Find the `pdf_parsing_jobs` table
3. Enable **Realtime** replication
4. Save changes

Alternatively, run this SQL:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE pdf_parsing_jobs;
```

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
pdf-parser-app/
├── app/
│   ├── actions/
│   │   └── pdf-actions.ts       # Server Actions for PDF operations
│   ├── layout.tsx               # Root layout
│   ├── page.tsx                 # Main application page
│   └── globals.css              # Global styles
├── components/
│   ├── pdf-upload.tsx           # File upload component
│   ├── parsing-progress.tsx     # Progress tracking component
│   └── parsed-results.tsx       # Results display component
├── lib/
│   ├── supabase/
│   │   ├── client.ts            # Client-side Supabase client
│   │   └── server.ts            # Server-side Supabase client
│   └── types/
│       └── database.types.ts    # TypeScript types
├── supabase/
│   ├── functions/
│   │   └── parse-pdf/           # Edge Function for PDF parsing
│   └── migrations/
│       └── 001_initial_schema.sql
└── middleware.ts                # Next.js middleware
```

## How It Works

1. **Upload**: User uploads a PDF file through the web interface (max 50MB)
2. **Storage**: Server action uploads file to Supabase Storage bucket `pdf-uploads`
3. **Job Creation**: A job record is created in the database with status "pending"
4. **Trigger**: Server action triggers the Supabase Edge Function asynchronously (fire-and-forget)
5. **Processing**:
   - Edge Function downloads the PDF from storage
   - Parses PDF using pdfjs-serverless in Deno runtime
   - Extracts text page by page
   - Updates database with progress every 10 pages
6. **Real-time Updates**: Client subscribes to Supabase Realtime and receives live progress updates
7. **Results**: When complete, extracted text and metadata are automatically displayed
8. **Download**: User can download extracted text as a TXT file

## Database Schema

### pdf_parsing_jobs Table

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| file_name | TEXT | Original file name |
| file_path | TEXT | Storage path |
| file_size | BIGINT | File size in bytes |
| status | TEXT | pending, processing, completed, failed |
| total_pages | INTEGER | Total number of pages |
| processed_pages | INTEGER | Pages processed so far |
| parsed_content | JSONB | PDF metadata |
| extracted_text | TEXT | Extracted text content |
| error_message | TEXT | Error details if failed |
| created_at | TIMESTAMPTZ | Creation timestamp |
| updated_at | TIMESTAMPTZ | Last update timestamp |

## Deployment

### Deploy to Vercel (or any hosting platform)

1. **Deploy Edge Functions First**:
```bash
# Deploy to Supabase production
supabase functions deploy parse-pdf

# Verify deployment
supabase functions list
```

2. **Deploy Next.js App**:

**Option A: Vercel (Recommended)**
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel

# Add environment variables in Vercel Dashboard:
# - NEXT_PUBLIC_SUPABASE_URL
# - NEXT_PUBLIC_SUPABASE_ANON_KEY
# - SUPABASE_SERVICE_ROLE_KEY
```

**Option B: Other Platforms**
- Build: `npm run build`
- Start: `npm start`
- Ensure all environment variables are set

3. **Post-Deployment**:
- Verify Edge Function is accessible
- Test file upload with a small PDF
- Check real-time updates are working
- Monitor Edge Function logs for any errors

## Configuration

### File Upload Limits

- Maximum file size: 50MB (configurable in `pdf-actions.ts`)
- Allowed types: PDF only

### Edge Function Timeout

- Default: 150 seconds
- For larger PDFs, consider implementing chunked processing

## Troubleshooting

### Real-time Updates Not Working

**Symptom**: Progress bar doesn't update, UI stays on "processing" forever

**Solution**:
1. Enable Realtime in Supabase Dashboard: **Database > Replication**
2. Ensure `pdf_parsing_jobs` table has Realtime enabled
3. Check browser console for WebSocket connection errors
4. Verify the client is subscribing correctly (check console logs)

### Edge Function Not Triggering

**Symptom**: Job stays in "pending" status

**Solution**:
1. Check that the Edge Function is deployed: `supabase functions list`
2. Verify `SUPABASE_SERVICE_ROLE_KEY` is set in `.env.local`
3. Check Edge Function logs in Supabase Dashboard: **Edge Functions > parse-pdf > Logs**
4. Ensure the function URL is correct in `app/actions/pdf-actions.ts:65`

### PDF Parsing Fails

**Symptom**: Job status changes to "failed" with error message

**Solution**:
1. Check Edge Function logs in Supabase Dashboard for detailed error
2. Verify the PDF file is valid and not corrupted
3. Check file size - very large PDFs may timeout (Edge Functions have 150s limit)
4. Ensure pdfjs-serverless is imported correctly in the Edge Function
5. Verify storage bucket `pdf-uploads` exists and is accessible

### Upload Fails

**Symptom**: "Failed to upload file" error

**Solution**:
1. Check that storage bucket `pdf-uploads` exists
2. Verify storage policies allow uploads
3. Ensure file is a valid PDF and under 50MB
4. Check that environment variables are set correctly

## Development

### Running Tests

Upload test PDFs to verify functionality:
- Small PDF (1-5 pages) - should complete in seconds
- Medium PDF (50-100 pages) - progress updates every 10 pages
- Large PDF (300+ pages) - tests timeout handling

### Generate TypeScript Types

After modifying database schema, regenerate types:

```bash
supabase gen types typescript --local > lib/types/database.types.ts
```

### Local Supabase Development

```bash
# Start local Supabase instance
supabase start

# Stop local Supabase
supabase stop

# View logs
supabase functions logs parse-pdf

# Test edge function locally
supabase functions serve parse-pdf
```

### Development Commands

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint
```

## Current Status

✅ **Fully Functional** - All features implemented and tested

**Working Features**:
- PDF upload with validation (type, size)
- Real-time progress tracking via Supabase Realtime
- PDF parsing using pdfjs-serverless in Deno Edge Functions
- Progress updates every 10 pages
- Automatic UI updates when parsing completes
- Beautiful responsive UI with gradients and animations
- Download extracted text as TXT
- Error handling and status notifications
- Support for large PDFs (300+ pages tested)

**Component Architecture**:
- `pdf-upload.tsx` - File upload with validation
- `parsing-progress.tsx` - Real-time progress display with Supabase subscription
- `parsed-results.tsx` - Results display with statistics and download
- `app/page.tsx` - Main page with state management
- `app/actions/pdf-actions.ts` - Server actions for upload and database operations
- `supabase/functions/parse-pdf/index.ts` - Edge Function for PDF processing

## License

MIT

## Contributing

Pull requests are welcome! For major changes, please open an issue first.

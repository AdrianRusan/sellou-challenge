-- Enable pgmq extension for queue management (must be in pgmq schema)
CREATE EXTENSION IF NOT EXISTS pgmq;

-- Create queue for page-level parsing tasks (different name from table to avoid conflicts)
SELECT pgmq.create('pdf_page_queue');

-- Table to track individual page parsing status
CREATE TABLE public.pdf_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.pdf_parsing_jobs(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL,
  extracted_text TEXT,
  status TEXT CHECK (status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
  error_message TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(job_id, page_number)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_pdf_pages_job_id ON pdf_pages(job_id);
CREATE INDEX IF NOT EXISTS idx_pdf_pages_status ON pdf_pages(status);
CREATE INDEX IF NOT EXISTS idx_pdf_pages_job_status ON pdf_pages(job_id, status);

-- Enable Row Level Security
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename = 'pdf_pages'
    AND rowsecurity = true
  ) THEN
    ALTER TABLE pdf_pages ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Allow all operations (matches existing pdf_parsing_jobs policy)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'pdf_pages'
    AND policyname = 'Allow all operations'
  ) THEN
    CREATE POLICY "Allow all operations" ON pdf_pages FOR ALL USING (true);
  END IF;
END $$;

-- Function to atomically update page text and job progress
CREATE OR REPLACE FUNCTION update_page_text(
  p_job_id UUID,
  p_page_number INTEGER,
  p_text TEXT
) RETURNS void AS $$
DECLARE
  v_total_pages INTEGER;
  v_processed_pages INTEGER;
BEGIN
  -- Update page status and text
  UPDATE pdf_pages
  SET
    extracted_text = p_text,
    status = 'completed',
    processed_at = NOW()
  WHERE job_id = p_job_id AND page_number = p_page_number;

  -- Increment job progress counter
  UPDATE pdf_parsing_jobs
  SET
    processed_pages = processed_pages + 1,
    updated_at = NOW()
  WHERE id = p_job_id;

  -- Check if all pages are complete
  SELECT total_pages, processed_pages
  INTO v_total_pages, v_processed_pages
  FROM pdf_parsing_jobs
  WHERE id = p_job_id;

  -- Mark job as completed when all pages done
  IF v_processed_pages >= v_total_pages THEN
    UPDATE pdf_parsing_jobs
    SET status = 'completed'
    WHERE id = p_job_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Add new status to pdf_parsing_jobs: 'queued'
ALTER TABLE pdf_parsing_jobs DROP CONSTRAINT IF EXISTS pdf_parsing_jobs_status_check;
ALTER TABLE pdf_parsing_jobs ADD CONSTRAINT pdf_parsing_jobs_status_check
  CHECK (status IN ('pending', 'queued', 'processing', 'completed', 'failed'));

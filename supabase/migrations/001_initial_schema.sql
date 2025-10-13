-- Create pdf_parsing_jobs table
CREATE TABLE pdf_parsing_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  status TEXT CHECK (status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
  total_pages INTEGER,
  processed_pages INTEGER DEFAULT 0,
  parsed_content JSONB,
  extracted_text TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying by status
CREATE INDEX idx_pdf_jobs_status ON pdf_parsing_jobs(status);

-- Index for querying by created_at
CREATE INDEX idx_pdf_jobs_created_at ON pdf_parsing_jobs(created_at DESC);

-- Enable Row Level Security
ALTER TABLE pdf_parsing_jobs ENABLE ROW LEVEL SECURITY;

-- Allow all operations (adjust based on your auth requirements)
CREATE POLICY "Allow all operations" ON pdf_parsing_jobs FOR ALL USING (true);

-- Create storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('pdf-uploads', 'pdf-uploads', false);

-- Storage policy - Allow all operations
CREATE POLICY "Allow all operations on pdf-uploads"
ON storage.objects FOR ALL
USING (bucket_id = 'pdf-uploads');

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
CREATE TRIGGER update_pdf_jobs_updated_at
BEFORE UPDATE ON pdf_parsing_jobs
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

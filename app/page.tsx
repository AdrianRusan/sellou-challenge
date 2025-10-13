'use client'

import { useState, useEffect } from 'react'
import PdfUpload from '@/components/pdf-upload'
import ParsingProgress from '@/components/parsing-progress'
import ParsedResults from '@/components/parsed-results'
import { createClient } from '@/lib/supabase/client'

export default function Home() {
  const [currentJobId, setCurrentJobId] = useState<string | null>(null)
  const [jobStatus, setJobStatus] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    if (!currentJobId) return

    // Subscribe to job updates
    const channel = supabase
      .channel('current-job')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'pdf_parsing_jobs',
          filter: `id=eq.${currentJobId}`,
        },
        (payload: any) => {
          console.log('Job status updated:', payload.new.status)
          setJobStatus(payload.new.status)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentJobId])

  const handleUploadSuccess = (jobId: string) => {
    setCurrentJobId(jobId)
    setJobStatus('pending')
  }

  const handleNewUpload = () => {
    setCurrentJobId(null)
    setJobStatus(null)
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-2">PDF Parser</h1>
          <p className="text-gray-400">Upload and parse PDF files with real-time progress tracking</p>
        </div>

        <div className="space-y-6">
          {!currentJobId ? (
            <PdfUpload onUploadSuccess={handleUploadSuccess} />
          ) : (
            <>
              <ParsingProgress jobId={currentJobId} />

              {(jobStatus === 'completed' || jobStatus === 'failed') && (
                <>
                  {jobStatus === 'completed' && <ParsedResults jobId={currentJobId} />}

                  <div className="text-center">
                    <button
                      onClick={handleNewUpload}
                      className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                    >
                      Upload Another PDF
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        <div className="text-center mt-12 text-gray-500 text-sm">
          Built with Next.js 15, Supabase, and Tailwind CSS
        </div>
      </div>
    </main>
  )
}

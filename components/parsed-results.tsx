'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Job {
  id: string
  file_name: string
  status: string
  total_pages: number | null
  extracted_text: string | null
  parsed_content: any
  created_at: string
}

export default function ParsedResults({ jobId }: { jobId: string }) {
  const [job, setJob] = useState<Job | null>(null)
  const [showFullText, setShowFullText] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    fetchJob()
  }, [jobId])

  async function fetchJob() {
    // Fetch job metadata
    const { data: job } = await supabase
      .from('pdf_parsing_jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (job) {
      // If job is completed, fetch and combine page texts
      if (job.status === 'completed') {
        const { data: pages } = await supabase
          .from('pdf_pages')
          .select('page_number, extracted_text')
          .eq('job_id', jobId)
          .eq('status', 'completed')
          .order('page_number', { ascending: true })

        // Combine page texts in order
        if (pages && pages.length > 0) {
          const fullText = pages
            .map(p => p.extracted_text)
            .filter(Boolean)
            .join('\n\n')

          job.extracted_text = fullText
        }
      }

      setJob(job as Job)
    }
  }

  if (!job) {
    return (
      <div className="w-full max-w-4xl mx-auto p-8 bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700/50 shadow-2xl">
        <div className="flex items-center justify-center space-x-3">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse delay-75"></div>
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse delay-150"></div>
        </div>
      </div>
    )
  }

  if (job.status !== 'completed') {
    return null
  }

  const textPreview = job.extracted_text?.substring(0, 1000) || ''
  const hasMoreText = (job.extracted_text?.length || 0) > 1000
  const wordCount = job.extracted_text?.split(/\s+/).filter(word => word.length > 0).length || 0

  return (
    <div className="w-full max-w-4xl mx-auto p-8 bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700/50 shadow-2xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-3xl font-bold text-white flex items-center">
          <svg className="w-8 h-8 mr-3 text-green-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          Parsed Results
        </h2>
        <button
          onClick={() => {
            const blob = new Blob([job.extracted_text || ''], { type: 'text/plain' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `${job.file_name.replace('.pdf', '')}-extracted.txt`
            a.click()
            URL.revokeObjectURL(url)
          }}
          className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-blue-500/50 transition-all duration-200 flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download TXT
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 rounded-xl p-5 border border-blue-500/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-blue-400 uppercase tracking-wider">Pages</span>
            <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-3xl font-bold text-white">{job.total_pages?.toLocaleString()}</p>
        </div>

        <div className="bg-gradient-to-br from-green-500/10 to-green-600/5 rounded-xl p-5 border border-green-500/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-green-400 uppercase tracking-wider">Words</span>
            <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
            </svg>
          </div>
          <p className="text-3xl font-bold text-white">{wordCount.toLocaleString()}</p>
        </div>

        <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 rounded-xl p-5 border border-purple-500/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-purple-400 uppercase tracking-wider">Characters</span>
            <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-3xl font-bold text-white">{job.extracted_text?.length.toLocaleString()}</p>
        </div>

        <div className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 rounded-xl p-5 border border-cyan-500/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-cyan-400 uppercase tracking-wider">Parsed</span>
            <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-sm font-bold text-white mt-2">{new Date(job.created_at).toLocaleTimeString()}</p>
        </div>
      </div>

      <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-700/30">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-white flex items-center">
            <svg className="w-6 h-6 mr-2 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Extracted Text
          </h3>
          {hasMoreText && (
            <button
              onClick={() => setShowFullText(!showFullText)}
              className="px-4 py-2 bg-gray-700/50 hover:bg-gray-700 text-white text-sm font-medium rounded-lg border border-gray-600/50 transition-all duration-200"
            >
              {showFullText ? 'Show Less' : 'Show All'}
            </button>
          )}
        </div>

        <div className="bg-black/30 rounded-lg p-5 border border-gray-700/50 max-h-[600px] overflow-y-auto custom-scrollbar">
          <pre className="whitespace-pre-wrap text-sm font-mono text-gray-100 leading-relaxed">
            {showFullText ? job.extracted_text : textPreview}
            {!showFullText && hasMoreText && (
              <span className="text-gray-500 italic">
                {'\n\n'}... {(job.extracted_text?.length || 0) - 1000} more characters
              </span>
            )}
          </pre>
        </div>

        <div className="mt-4 flex items-center text-xs text-gray-500">
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          File: {job.file_name}
        </div>
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(55, 65, 81, 0.3);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(107, 114, 128, 0.5);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(107, 114, 128, 0.7);
        }
      `}</style>
    </div>
  )
}

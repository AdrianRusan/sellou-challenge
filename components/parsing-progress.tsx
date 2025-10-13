'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Job {
  id: string
  file_name: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  total_pages: number | null
  processed_pages: number | null
  error_message: string | null
}

export default function ParsingProgress({ jobId }: { jobId: string }) {
  const [job, setJob] = useState<Job | null>(null)
  const supabase = createClient()

  useEffect(() => {
    // Initial fetch
    fetchJob()

    // Subscribe to real-time updates
    const channel = supabase
      .channel('pdf-jobs')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'pdf_parsing_jobs',
          filter: `id=eq.${jobId}`,
        },
        (payload) => {
          console.log('Real-time update:', payload)
          setJob(payload.new as Job)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [jobId])

  async function fetchJob() {
    const { data } = await supabase
      .from('pdf_parsing_jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (data) setJob(data as Job)
  }

  if (!job) {
    return (
      <div className="w-full max-w-3xl mx-auto p-8 bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700/50 shadow-2xl">
        <div className="flex items-center justify-center space-x-3">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse delay-75"></div>
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse delay-150"></div>
        </div>
      </div>
    )
  }

  const progressPercentage = job.total_pages && job.processed_pages
    ? Math.round((job.processed_pages / job.total_pages) * 100)
    : 0

  return (
    <div className="w-full max-w-3xl mx-auto p-8 bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700/50 shadow-2xl">
      <h2 className="text-3xl font-bold mb-6 text-white flex items-center">
        <svg className="w-8 h-8 mr-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Parsing Progress
      </h2>

      <div className="space-y-6">
        <div className="bg-gray-900/50 rounded-xl p-5 border border-gray-700/30">
          <span className="text-sm font-medium text-gray-400 uppercase tracking-wider">File Name</span>
          <p className="text-lg text-white mt-2 font-medium break-all">{job.file_name}</p>
        </div>

        <div className="bg-gray-900/50 rounded-xl p-5 border border-gray-700/30">
          <span className="text-sm font-medium text-gray-400 uppercase tracking-wider">Status</span>
          <div className="mt-3 flex items-center">
            <span className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-bold uppercase tracking-wide ${
              job.status === 'completed'
                ? 'bg-green-500/20 text-green-400 border border-green-500/50' :
              job.status === 'processing'
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50 animate-pulse' :
              job.status === 'failed'
                ? 'bg-red-500/20 text-red-400 border border-red-500/50' :
                'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50'
            }`}>
              {job.status === 'completed' && (
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              )}
              {job.status === 'processing' && (
                <svg className="w-5 h-5 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              {job.status === 'failed' && (
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              )}
              {job.status === 'pending' && (
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                </svg>
              )}
              {job.status}
            </span>
          </div>
        </div>

        {job.total_pages && (
          <div className="bg-gray-900/50 rounded-xl p-5 border border-gray-700/30">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-medium text-gray-400 uppercase tracking-wider">Progress</span>
              <span className="text-2xl font-bold text-white">{progressPercentage}%</span>
            </div>

            <div className="text-sm text-gray-400 mb-3">
              <span className="text-white font-semibold">{job.processed_pages}</span> of <span className="text-white font-semibold">{job.total_pages}</span> pages processed
            </div>

            <div className="relative w-full bg-gray-700/50 rounded-full h-4 overflow-hidden border border-gray-600/50">
              <div
                className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all duration-500 ease-out shadow-lg shadow-blue-500/50"
                style={{ width: `${progressPercentage}%` }}
              >
                <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
              </div>
            </div>
          </div>
        )}

        {job.status === 'failed' && job.error_message && (
          <div className="bg-red-500/10 backdrop-blur-sm border border-red-500/50 rounded-xl p-5">
            <div className="flex items-start">
              <svg className="w-6 h-6 text-red-400 mr-3 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-red-400 mb-1">Error Occurred</p>
                <p className="text-sm text-red-300">{job.error_message}</p>
              </div>
            </div>
          </div>
        )}

        {job.status === 'completed' && (
          <div className="bg-green-500/10 backdrop-blur-sm border border-green-500/50 rounded-xl p-5">
            <div className="flex items-center">
              <svg className="w-6 h-6 text-green-400 mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <p className="text-sm font-semibold text-green-400">Parsing completed successfully!</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

'use client'

import { useState, useRef } from 'react'
import { createJobAfterUpload } from '@/app/actions/pdf-actions'
import { createClient } from '@/lib/supabase/client'

export default function PdfUpload({ onUploadSuccess }: { onUploadSuccess: (jobId: string) => void }) {
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadStatus, setUploadStatus] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      setError(null)
      setUploadProgress(0)
      setUploadStatus('')
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (!selectedFile) {
      setError('Please select a PDF file')
      return
    }

    // Validate file type
    if (selectedFile.type !== 'application/pdf') {
      setError('File must be a PDF')
      return
    }

    // Validate file size (max 50MB)
    const maxSize = 50 * 1024 * 1024 // 50MB
    if (selectedFile.size > maxSize) {
      setError('File size must be less than 50MB')
      return
    }

    setUploading(true)
    setError(null)
    setUploadProgress(0)
    setUploadStatus('Preparing...')

    let uploadedFilePath: string | null = null

    try {
      // Step 1: Extract PDF metadata (page count)
      setUploadStatus('Reading PDF...')
      const arrayBuffer = await selectedFile.arrayBuffer()
      const { getDocumentProxy } = await import('unpdf')
      const pdf = await getDocumentProxy(new Uint8Array(arrayBuffer))
      const totalPages = pdf.numPages

      if (!totalPages || totalPages <= 0) {
        throw new Error('Invalid PDF: Could not determine page count')
      }

      // Step 2: Generate unique file path
      const timestamp = Date.now()
      const fileName = selectedFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')
      const filePath = `${timestamp}-${fileName}`
      uploadedFilePath = filePath

      // Step 3: Upload file directly to Supabase Storage
      setUploadStatus('Uploading to storage...')
      setUploadProgress(10)

      const supabase = createClient()
      const { error: uploadError } = await supabase.storage
        .from('pdf-uploads')
        .upload(filePath, selectedFile, {
          contentType: 'application/pdf',
          upsert: false,
        })

      if (uploadError) {
        console.error('Upload error:', uploadError)
        throw new Error('Failed to upload file to storage')
      }

      setUploadProgress(60)
      setUploadStatus('Creating job...')

      // Step 4: Create job record with metadata
      const result = await createJobAfterUpload({
        fileName: selectedFile.name,
        filePath: filePath,
        fileSize: selectedFile.size,
        totalPages: totalPages,
      })

      if (result.error) {
        // Rollback: Delete uploaded file if job creation fails
        await supabase.storage.from('pdf-uploads').remove([filePath])
        throw new Error(result.error)
      }

      if (result.success && result.jobId) {
        setUploadProgress(100)
        setUploadStatus('Complete!')

        // Reset form
        setSelectedFile(null)
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }

        // Notify parent component
        onUploadSuccess(result.jobId)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred'
      setError(errorMessage)
      console.error('Upload error:', err)

      // Attempt cleanup if upload succeeded but something else failed
      if (uploadedFilePath) {
        try {
          const supabase = createClient()
          await supabase.storage.from('pdf-uploads').remove([uploadedFilePath])
        } catch (cleanupError) {
          console.error('Cleanup error:', cleanupError)
        }
      }
    } finally {
      setUploading(false)
      if (error) {
        setUploadProgress(0)
        setUploadStatus('')
      }
    }
  }

  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
        Upload PDF
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="pdf-file"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            Select PDF File (Max 50MB)
          </label>
          <input
            ref={fileInputRef}
            id="pdf-file"
            name="file"
            type="file"
            accept="application/pdf"
            onChange={handleFileChange}
            disabled={uploading}
            className="block w-full text-sm text-gray-900 dark:text-gray-300
                     border border-gray-300 dark:border-gray-600 rounded-lg
                     cursor-pointer bg-gray-50 dark:bg-gray-700
                     focus:outline-none focus:ring-2 focus:ring-blue-500
                     disabled:opacity-50 disabled:cursor-not-allowed
                     file:mr-4 file:py-2 file:px-4
                     file:rounded-l-lg file:border-0
                     file:text-sm file:font-semibold
                     file:bg-blue-50 file:text-blue-700
                     dark:file:bg-gray-600 dark:file:text-gray-300
                     hover:file:bg-blue-100 dark:hover:file:bg-gray-500"
          />
          {selectedFile && (
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
            </p>
          )}
        </div>

        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {uploading && uploadProgress > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
              <span>{uploadStatus}</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
              <div
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={uploading || !selectedFile}
          className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700
                   disabled:bg-gray-400 disabled:cursor-not-allowed
                   text-white font-medium rounded-lg
                   focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                   transition-colors duration-200"
        >
          {uploading ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {uploadStatus || 'Uploading...'}
            </span>
          ) : (
            'Upload and Parse PDF'
          )}
        </button>
      </form>
    </div>
  )
}

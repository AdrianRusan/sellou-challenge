'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function uploadAndParsePdf(formData: FormData) {
  try {
    const file = formData.get('file') as File

    if (!file) {
      return { error: 'No file provided' }
    }

    // Validate file type
    if (file.type !== 'application/pdf') {
      return { error: 'File must be a PDF' }
    }

    // Validate file size (max 50MB)
    const maxSize = 50 * 1024 * 1024 // 50MB
    if (file.size > maxSize) {
      return { error: 'File size must be less than 50MB' }
    }

    const supabase = await createServiceClient()

    // Generate unique file path
    const timestamp = Date.now()
    const fileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const filePath = `${timestamp}-${fileName}`

    // Upload file to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('pdf-uploads')
      .upload(filePath, file, {
        contentType: 'application/pdf',
        upsert: false,
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return { error: 'Failed to upload file' }
    }

    // Create job record in database
    const { data: job, error: jobError } = await supabase
      .from('pdf_parsing_jobs')
      .insert({
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        status: 'pending',
      })
      .select()
      .single()

    if (jobError || !job) {
      console.error('Job creation error:', jobError)
      // Clean up uploaded file
      await supabase.storage.from('pdf-uploads').remove([filePath])
      return { error: 'Failed to create parsing job' }
    }

    // Trigger Edge Function asynchronously
    const functionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/parse-pdf`

    // Fire and forget - don't wait for response
    fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ jobId: job.id }),
    }).catch((error) => {
      console.error('Failed to trigger parsing function:', error)
    })

    revalidatePath('/')

    return {
      success: true,
      jobId: job.id,
      message: 'File uploaded successfully. Parsing started.'
    }

  } catch (error) {
    console.error('Upload action error:', error)
    return { error: 'An unexpected error occurred' }
  }
}

export async function getJob(jobId: string) {
  try {
    const supabase = await createClient()

    const { data: job, error } = await supabase
      .from('pdf_parsing_jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (error) {
      return { error: 'Job not found' }
    }

    return { job }
  } catch (error) {
    console.error('Get job error:', error)
    return { error: 'Failed to fetch job' }
  }
}

export async function getAllJobs() {
  try {
    const supabase = await createClient()

    const { data: jobs, error } = await supabase
      .from('pdf_parsing_jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      return { error: 'Failed to fetch jobs' }
    }

    return { jobs }
  } catch (error) {
    console.error('Get jobs error:', error)
    return { error: 'Failed to fetch jobs' }
  }
}

export async function deleteJob(jobId: string) {
  try {
    const supabase = await createServiceClient()

    // Get job to find file path
    const { data: job } = await supabase
      .from('pdf_parsing_jobs')
      .select('file_path')
      .eq('id', jobId)
      .single()

    if (job?.file_path) {
      // Delete file from storage
      await supabase.storage
        .from('pdf-uploads')
        .remove([job.file_path])
    }

    // Delete job record
    const { error } = await supabase
      .from('pdf_parsing_jobs')
      .delete()
      .eq('id', jobId)

    if (error) {
      return { error: 'Failed to delete job' }
    }

    revalidatePath('/')
    return { success: true }
  } catch (error) {
    console.error('Delete job error:', error)
    return { error: 'Failed to delete job' }
  }
}

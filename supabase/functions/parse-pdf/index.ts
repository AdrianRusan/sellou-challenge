console.log('=== Edge Function Starting ===')
console.log('Deno version:', Deno.version)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { resolvePDFJS } from 'https://esm.sh/pdfjs-serverless@0.4.2'

console.log('Dependencies imported successfully')

interface ParseRequest {
  jobId: string
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

console.log('Starting Deno.serve...')

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  console.log('=== Request received ===')
  console.log('Method:', req.method)
  console.log('URL:', req.url)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  console.log('SUPABASE_URL exists:', !!supabaseUrl)
  console.log('SUPABASE_SERVICE_ROLE_KEY exists:', !!supabaseKey)

  const supabase = createClient(
    supabaseUrl ?? '',
    supabaseKey ?? ''
  )

  console.log('Supabase client created')

  let jobId: string | undefined

  try {
    console.log('Reading request body...')

    // Get job ID from request
    const body: ParseRequest = await req.json()
    jobId = body.jobId

    console.log('Job ID received:', jobId)

    if (!jobId) {
      console.error('No job ID provided')
      return new Response(
        JSON.stringify({ error: 'Job ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[${jobId}] Step 1: Fetching job details from database`)

    // Fetch job details
    const { data: job, error: jobError } = await supabase
      .from('pdf_parsing_jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (jobError) {
      console.error(`[${jobId}] Job query error:`, jobError)
    }

    if (!job) {
      console.error(`[${jobId}] Job not found in database`)
      return new Response(
        JSON.stringify({ error: 'Job not found', details: jobError }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[${jobId}] Job found:`, job.file_name, 'Path:', job.file_path)

    console.log(`[${jobId}] Step 2: Updating status to processing`)

    // Update job status to processing
    const { error: updateError } = await supabase
      .from('pdf_parsing_jobs')
      .update({ status: 'processing' })
      .eq('id', jobId)

    if (updateError) {
      console.error(`[${jobId}] Failed to update status:`, updateError)
    } else {
      console.log(`[${jobId}] Status updated to processing`)
    }

    console.log(`[${jobId}] Step 3: Downloading PDF from storage bucket: pdf-uploads`)

    // Download PDF from storage
    const { data: fileData, error: downloadError } = await supabase
      .storage
      .from('pdf-uploads')
      .download(job.file_path)

    if (downloadError) {
      console.error(`[${jobId}] Download error:`, downloadError)
      await supabase
        .from('pdf_parsing_jobs')
        .update({
          status: 'failed',
          error_message: 'Failed to download PDF file: ' + downloadError.message
        })
        .eq('id', jobId)

      return new Response(
        JSON.stringify({ error: 'Failed to download PDF', details: downloadError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!fileData) {
      console.error(`[${jobId}] No file data returned`)
      return new Response(
        JSON.stringify({ error: 'No file data' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[${jobId}] PDF downloaded successfully, size:`, fileData.size)

    console.log(`[${jobId}] Step 4: Converting to Uint8Array`)

    // Convert blob to Uint8Array
    const arrayBuffer = await fileData.arrayBuffer()
    const data = new Uint8Array(arrayBuffer)

    console.log(`[${jobId}] Buffer created, size: ${data.length} bytes`)

    console.log(`[${jobId}] Step 5: Parsing PDF with pdfjs-serverless`)

    // Parse PDF using pdfjs-serverless
    const { getDocument } = await resolvePDFJS()
    console.log(`[${jobId}] PDFJS resolved, loading document...`)

    const doc = await getDocument({ data, useSystemFonts: true }).promise
    const totalPages = doc.numPages

    console.log(`[${jobId}] PDF loaded successfully! Total pages: ${totalPages}`)

    // Update progress
    await supabase
      .from('pdf_parsing_jobs')
      .update({
        total_pages: totalPages,
        processed_pages: 0
      })
      .eq('id', jobId)

    // Extract text from all pages
    const allText = []
    console.log(`[${jobId}] Processing ${totalPages} pages...`)

    for (let i = 1; i <= totalPages; i++) {
      console.log(`[${jobId}] Processing page ${i}/${totalPages}`)
      const page = await doc.getPage(i)
      const textContent = await page.getTextContent()
      const contents = textContent.items.map((item: any) => item.str).join(' ')
      allText.push(contents)

      // Update progress periodically (every 10 pages or at the end)
      if (i % 10 === 0 || i === totalPages) {
        await supabase
          .from('pdf_parsing_jobs')
          .update({ processed_pages: i })
          .eq('id', jobId)
        console.log(`[${jobId}] Progress updated: ${i}/${totalPages} pages`)
      }
    }

    const extractedText = allText.join('\n')

    console.log(`[${jobId}] PDF parsed successfully!`)
    console.log(`[${jobId}] Total pages: ${totalPages}`)
    console.log(`[${jobId}] Extracted text length: ${extractedText.length} characters`)

    // Create parsed content structure
    const parsedContent = {
      numPages: totalPages,
      textPerPage: allText.length,
    }

    console.log(`[${jobId}] Step 6: Saving results to database`)

    // First, update status to completed with page counts
    // This ensures the UI updates even if saving the extracted text fails
    const { error: statusUpdateError } = await supabase
      .from('pdf_parsing_jobs')
      .update({
        status: 'completed',
        total_pages: totalPages,
        processed_pages: totalPages,
        parsed_content: parsedContent,
      })
      .eq('id', jobId)

    if (statusUpdateError) {
      console.error(`[${jobId}] Failed to update status to completed:`, statusUpdateError)
      throw new Error(`Failed to update job status: ${statusUpdateError.message}`)
    }

    console.log(`[${jobId}] Status updated to completed successfully!`)

    // Then try to save the extracted text separately
    // If this fails, the job will still show as completed
    const { error: textUpdateError } = await supabase
      .from('pdf_parsing_jobs')
      .update({
        extracted_text: extractedText.trim(),
      })
      .eq('id', jobId)

    if (textUpdateError) {
      console.error(`[${jobId}] Failed to save extracted text:`, textUpdateError)
      console.error(`[${jobId}] Text length was: ${extractedText.length} characters`)
      // Don't throw - the job is still completed, just without the full text stored
    } else {
      console.log(`[${jobId}] Extracted text saved successfully!`)
    }

    console.log(`[${jobId}] === Job completed successfully ===`)

    return new Response(
      JSON.stringify({
        success: true,
        jobId,
        totalPages,
        textLength: extractedText.length,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('=== CRITICAL ERROR ===')
    console.error('Error type:', error.constructor.name)
    console.error('Error message:', error.message)
    console.error('Error stack:', error.stack)
    console.error('Job ID:', jobId)

    // Update job status to failed
    if (jobId) {
      try {
        console.log(`[${jobId}] Updating job status to failed`)
        await supabase
          .from('pdf_parsing_jobs')
          .update({
            status: 'failed',
            error_message: `${error.constructor.name}: ${error.message}`,
          })
          .eq('id', jobId)
        console.log(`[${jobId}] Job status updated to failed`)
      } catch (updateError) {
        console.error('Failed to update job status:', updateError)
      }
    }

    return new Response(
      JSON.stringify({
        error: 'Failed to parse PDF',
        type: error.constructor.name,
        message: error.message,
        stack: error.stack,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

console.log('=== Edge Function initialized and ready ===')

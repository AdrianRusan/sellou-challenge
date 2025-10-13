console.log('=== PDF Worker Starting ===')
console.log('Deno version:', Deno.version)

import { createClient } from 'npm:@supabase/supabase-js@2'
import { getDocumentProxy } from 'npm:unpdf'

console.log('Dependencies imported successfully')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  console.log('=== Worker invocation started ===')

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  const supabase = createClient(
    supabaseUrl ?? '',
    supabaseKey ?? ''
  )

  const startTime = Date.now()
  const MAX_PROCESSING_TIME = 130000 // 130 seconds (20-second buffer)
  const MAX_PAGES_PER_INVOCATION = 30 // Limit pages to avoid resource exhaustion
  let pagesProcessed = 0
  let pagesSkipped = 0

  // Cache for downloaded PDFs (file_path -> pdf object)
  const pdfCache = new Map()

  try {
    // Process pages until we approach timeout or hit page limit
    while ((Date.now() - startTime) < MAX_PROCESSING_TIME && pagesProcessed < MAX_PAGES_PER_INVOCATION) {
      // Read one page task from queue (non-blocking)
      const { data: messages, error: queueError } = await supabase
        .rpc('pgmq_read', {
          p_queue_name: 'pdf_page_queue',
          p_vt: 30, // Visibility timeout: 30 seconds
          p_qty: 1  // Read 1 message at a time
        })

      if (queueError) {
        console.error('Queue read error:', queueError)
        break
      }

      if (!messages || messages.length === 0) {
        console.log('No more tasks in queue')
        break
      }

      const message = messages[0]
      const { msg_id, message: payload } = message
      const { job_id, file_path, page_number, total_pages } = payload

      console.log(`[${job_id}] Processing page ${page_number}/${total_pages}`)

      try {
        // Mark page as processing
        await supabase
          .from('pdf_pages')
          .update({ status: 'processing' })
          .eq('job_id', job_id)
          .eq('page_number', page_number)

        // Update job status to processing if first page
        if (page_number === 1) {
          await supabase
            .from('pdf_parsing_jobs')
            .update({ status: 'processing' })
            .eq('id', job_id)
        }

        // Download PDF from storage (with caching)
        let pdf = pdfCache.get(file_path)

        if (!pdf) {
          console.log(`[${job_id}] Downloading PDF: ${file_path}`)
          const { data: fileData, error: downloadError } = await supabase.storage
            .from('pdf-uploads')
            .download(file_path)

          if (downloadError) throw downloadError
          if (!fileData) throw new Error('No file data returned')

          const arrayBuffer = await fileData.arrayBuffer()
          pdf = await getDocumentProxy(new Uint8Array(arrayBuffer))
          pdfCache.set(file_path, pdf)
          console.log(`[${job_id}] PDF cached`)
        } else {
          console.log(`[${job_id}] Using cached PDF`)
        }

        // Parse single page
        const page = await pdf.getPage(page_number)
        const textContent = await page.getTextContent()

        // Extract text with proper formatting
        let pageText = ''
        let lastY = null

        for (const item of textContent.items) {
          if (item.str && item.str.trim().length > 0) {
            // Detect line breaks by vertical position
            if (lastY !== null && item.transform && Math.abs(item.transform[5] - lastY) > 5) {
              pageText += '\n'
            }
            pageText += item.str + ' '
            if (item.transform) {
              lastY = item.transform[5]
            }
          }
        }

        const trimmedText = pageText.trim()

        // Update database using atomic function
        const { error: updateError } = await supabase.rpc('update_page_text', {
          p_job_id: job_id,
          p_page_number: page_number,
          p_text: trimmedText
        })

        if (updateError) {
          throw new Error(`Database update failed: ${updateError.message}`)
        }

        console.log(`[${job_id}] Page ${page_number} completed: ${trimmedText.length} characters`)

        // Delete message from queue (successful processing)
        await supabase.rpc('pgmq_delete', {
          p_queue_name: 'pdf_page_queue',
          p_msg_id: msg_id
        })

        pagesProcessed++

      } catch (pageError) {
        console.error(`[${job_id}] Error processing page ${page_number}:`, pageError)

        // Mark page as failed
        await supabase
          .from('pdf_pages')
          .update({
            status: 'failed',
            error_message: pageError.message || 'Unknown error'
          })
          .eq('job_id', job_id)
          .eq('page_number', page_number)

        // Archive failed message (don't retry)
        await supabase.rpc('pgmq_archive', {
          p_queue_name: 'pdf_page_queue',
          p_msg_id: msg_id
        })

        pagesSkipped++
      }
    }

    const runtime = Date.now() - startTime
    console.log(`Worker completed: ${pagesProcessed} pages processed, ${pagesSkipped} skipped, ${runtime}ms runtime`)

    return new Response(
      JSON.stringify({
        success: true,
        pagesProcessed,
        pagesSkipped,
        runtime
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Worker error:', error)
    return new Response(
      JSON.stringify({
        error: error.message,
        pagesProcessed,
        pagesSkipped
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

console.log('=== PDF Worker initialized ===')

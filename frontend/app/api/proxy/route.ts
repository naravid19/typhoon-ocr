import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { url } = await request.json();
    
    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    // Validate URL format
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return NextResponse.json(
        { error: 'Only HTTP and HTTPS URLs are supported' },
        { status: 400 }
      );
    }

    // Fetch the file from the URL
    console.log(`[Proxy] Proxying request to: ${url}`);
    
    // Create a custom agent to handle potential SSL issues if needed
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/pdf,application/json,text/plain,*/*',
        'Referer': new URL(url).origin,
      },
      cache: 'no-store',
      redirect: 'follow', 
    });

    console.log(`[Proxy] Upstream status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
        return NextResponse.json(
            { error: `Upstream server returned ${response.status} ${response.statusText}` },
            { status: response.status }
        );
    }
    
    const contentType = response.headers.get('content-type');
    const arrayBuffer = await response.arrayBuffer();
    
    if (arrayBuffer.byteLength === 0) {
        return NextResponse.json(
            { error: 'Received empty file from URL' },
            { status: 502 }
        );
    }
    
    // Extract filename from URL (for X-Filename header only)
    const filename = parsedUrl.pathname.split('/').pop() || 'document.pdf';
    
    // Return using standard Response object with ArrayBuffer
    // Use 'inline' to prevent download managers (IDM) from intercepting the request
    return new Response(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType || 'application/pdf',
        'Content-Length': arrayBuffer.byteLength.toString(),
        'Content-Disposition': `inline; filename="${filename}"`,
        'X-Filename': filename,
      },
    });
    
  } catch (error) {
    console.error('Proxy fetch error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch file' },
      { status: 500 }
    );
  }
}

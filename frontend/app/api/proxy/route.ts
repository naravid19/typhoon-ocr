import { NextResponse } from 'next/server';
import dns from 'dns/promises';
import net from 'net';

function isPrivateIp(ip: string): boolean {
  if (ip === '127.0.0.1' || ip === '::1' || ip === '0.0.0.0') return true;

  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    // 10.0.0.0/8
    if (parts[0] === 10) return true;
    // 172.16.0.0/12
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    // 192.168.0.0/16
    if (parts[0] === 192 && parts[1] === 168) return true;
    // 127.0.0.0/8
    if (parts[0] === 127) return true;
    // 169.254.0.0/16 (link-local, cloud metadata)
    if (parts[0] === 169 && parts[1] === 254) return true;
    // 0.0.0.0/8
    if (parts[0] === 0) return true;
    // 224.0.0.0/4 (multicast)
    if (parts[0] >= 224 && parts[0] <= 239) return true;
    // 240.0.0.0/4 (reserved / broadcast)
    if (parts[0] >= 240) return true;
    return false;
  }

  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === '::1' || lower === '0:0:0:0:0:0:0:1') return true;
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
    if (lower.startsWith('fe80')) return true;
    if (lower.startsWith('ff')) return true; // IPv6 multicast
    if (lower.startsWith('::ffff:')) {
      const ipv4Part = ip.substring(7);
      return isPrivateIp(ipv4Part);
    }
  }

  return false;
}

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

    // Block obvious local hostnames immediately
    const lowerHostname = parsedUrl.hostname.toLowerCase();
    if (
      lowerHostname === 'localhost' ||
      lowerHostname.endsWith('.local') ||
      lowerHostname.endsWith('.internal')
    ) {
      return NextResponse.json(
        { error: 'Access to private or local network addresses is prohibited' },
        { status: 400 }
      );
    }

    // Resolve DNS and reject private/loopback IP addresses
    try {
      const lookup = await dns.lookup(parsedUrl.hostname, { all: true });
      for (const entry of lookup) {
        if (isPrivateIp(entry.address)) {
          return NextResponse.json(
            { error: 'Access to private or local network addresses is prohibited' },
            { status: 400 }
          );
        }
      }
    } catch {
      return NextResponse.json(
        { error: 'Could not resolve host' },
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

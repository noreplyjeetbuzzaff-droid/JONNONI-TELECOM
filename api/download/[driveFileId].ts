import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';

const DRIVE_ID_REGEX = /^[a-zA-Z0-9_-]{10,120}$/;

function sanitizeFileName(raw: string): string {
  const cleaned = raw.replace(/[/\\?%*:|"<>]/g, '_').trim();
  return cleaned || 'flash_file.bin';
}

function extractDriveConfirmUrl(html: string, driveFileId: string): string | null {
  const confirmMatch = html.match(/name="confirm"\s+value="([^"]+)"/i);
  const uuidMatch = html.match(/name="uuid"\s+value="([^"]+)"/i);
  const actionMatch = html.match(/action="([^"]+)"/i);

  const baseUrl = actionMatch
    ? actionMatch[1].replace(/&amp;/g, '&')
    : 'https://drive.usercontent.google.com/download';

  const url = new URL(baseUrl);
  url.searchParams.set('id', driveFileId);
  url.searchParams.set('export', 'download');
  url.searchParams.set('confirm', confirmMatch ? confirmMatch[1] : 't');
  if (uuidMatch) {
    url.searchParams.set('uuid', uuidMatch[1]);
  }
  return url.toString();
}

async function resolveDriveStreamResponse(driveFileId: string) {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (compatible; JonnoiTelecomPortal/1.0)',
  };

  const directUrl = `https://drive.usercontent.google.com/download?id=${encodeURIComponent(driveFileId)}&export=download&confirm=t`;
  const directRes = await fetch(directUrl, { redirect: 'follow', headers });
  const directType = directRes.headers.get('content-type') || '';
  if (directRes.ok && !directType.includes('text/html')) {
    return directRes;
  }
  if (directRes.body) {
    await directRes.body.cancel().catch(() => {});
  }

  const initialUrl = `https://drive.google.com/uc?export=download&id=${encodeURIComponent(driveFileId)}`;
  let response = await fetch(initialUrl, { redirect: 'follow', headers });

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('text/html')) {
    const html = await response.text();
    const cookies = response.headers.get('set-cookie') || '';
    const confirmUrl = extractDriveConfirmUrl(html, driveFileId);
    if (confirmUrl) {
      response = await fetch(confirmUrl, {
        redirect: 'follow',
        headers: {
          ...headers,
          ...(cookies ? { Cookie: cookies } : {}),
        },
      });
    }
  }

  return response;
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

export default async function handler(
  req: IncomingMessage & { query?: Record<string, string | string[] | undefined> },
  res: ServerResponse
) {
  const reqUrl = new URL(req.url || '/', 'http://localhost');
  const queryId = req.query?.driveFileId;
  const pathParts = reqUrl.pathname.split('/').filter(Boolean);
  const driveFileId =
    (Array.isArray(queryId) ? queryId[0] : queryId) ||
    pathParts[pathParts.length - 1] ||
    '';

  if (!DRIVE_ID_REGEX.test(driveFileId)) {
    sendJson(res, 400, { ready: false, error: 'Invalid file identifier.' });
    return;
  }

  const rawNameQuery = req.query?.name;
  const rawName =
    (Array.isArray(rawNameQuery) ? rawNameQuery[0] : rawNameQuery) ||
    reqUrl.searchParams.get('name') ||
    'download.bin';
  const fileName = sanitizeFileName(rawName);

  const probeQuery = req.query?.probe;
  const isProbe =
    (Array.isArray(probeQuery) ? probeQuery[0] : probeQuery) === '1' ||
    reqUrl.searchParams.get('probe') === '1';

  try {
    const upstream = await resolveDriveStreamResponse(driveFileId);
    const upstreamType =
      upstream.headers.get('content-type') || 'application/octet-stream';

    if (!upstream.ok || upstreamType.includes('text/html')) {
      if (upstream.body) {
        await upstream.body.cancel().catch(() => {});
      }
      sendJson(res, 404, {
        ready: false,
        error:
          'ফাইলটি সরাসরি ডাউনলোডের জন্য উন্মুক্ত নয় অথবা গুগল ড্রাইভে পাওয়া যায়নি।',
      });
      return;
    }

    if (isProbe) {
      const contentLength = upstream.headers.get('content-length');
      if (upstream.body) {
        await upstream.body.cancel().catch(() => {});
      }
      sendJson(res, 200, {
        ready: true,
        contentType: upstreamType,
        contentLength: contentLength ? Number(contentLength) : null,
      });
      return;
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', upstreamType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${fileName.replace(/"/g, '')}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
    );
    const contentLength = upstream.headers.get('content-length');
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }

    if (!upstream.body) {
      sendJson(res, 502, { error: 'Empty stream from storage.' });
      return;
    }

    const nodeStream = Readable.fromWeb(
      upstream.body as unknown as WebReadableStream<Uint8Array>
    );
    nodeStream.on('error', (err) => {
      console.error('Vercel download stream error:', err);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.end();
      } else {
        res.destroy();
      }
    });
    nodeStream.pipe(res);
  } catch (err) {
    console.error('Vercel direct download proxy error:', err);
    sendJson(res, 500, {
      ready: false,
      error: 'ডাউনলোড শুরু করতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।',
    });
  }
}

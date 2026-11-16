import { trackVisitorEvent } from './analyticsClient';

function triggerHiddenIframeDownload(url: string) {
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  iframe.src = url;
  document.body.appendChild(iframe);
  setTimeout(() => {
    if (iframe.parentNode) {
      iframe.parentNode.removeChild(iframe);
    }
  }, 60_000);
}

export async function triggerDirectWebDownload(
  driveFileId: string,
  fileName: string
): Promise<void> {
  const cleanName = fileName || 'flash_file.bin';
  const basePath = `/api/download/${encodeURIComponent(driveFileId)}`;
  const probeUrl = `${basePath}?probe=1`;

  // Record real-time download event in visitor analytics
  trackVisitorEvent({
    type: 'download',
    path: '/download',
    label: cleanName,
  }).catch(() => {});

  let proxyAvailable = false;
  try {
    const res = await fetch(probeUrl);
    const contentType = res.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      if (!res.ok) {
        let errMsg = 'ফাইলটি সরাসরি ডাউনলোড করা যায়নি।';
        try {
          const data = await res.json();
          if (data?.error) errMsg = data.error;
        } catch {
          // ignore
        }
        throw new Error(errMsg);
      }
      proxyAvailable = true;
    }
  } catch (err) {
    // Re-throw explicit API readiness errors (e.g. private Drive file)
    if (
      err instanceof Error &&
      (err.message.includes('গুগল ড্রাইভে') ||
        err.message.includes('সরাসরি ডাউনলোড'))
    ) {
      throw err;
    }
    proxyAvailable = false;
  }

  if (proxyAvailable) {
    const downloadEndpoint = `${basePath}?name=${encodeURIComponent(cleanName)}`;
    const link = document.createElement('a');
    link.href = downloadEndpoint;
    link.setAttribute('download', cleanName);
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return;
  }

  // Fallback for static/edge hosts where /api/download proxy is unavailable:
  // Stream directly via hidden iframe without redirecting the user away from the page
  const directUserContentUrl = `https://drive.usercontent.google.com/download?id=${encodeURIComponent(
    driveFileId
  )}&export=download&confirm=t`;
  triggerHiddenIframeDownload(directUserContentUrl);
}

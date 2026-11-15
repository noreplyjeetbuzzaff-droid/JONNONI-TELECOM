export async function triggerDirectWebDownload(
  driveFileId: string,
  fileName: string
): Promise<void> {
  const basePath = `/api/download/${encodeURIComponent(driveFileId)}`;
  const probeUrl = `${basePath}?probe=1`;

  const res = await fetch(probeUrl);
  if (!res.ok) {
    let errMsg = 'ফাইলটি সরাসরি ডাউনলোড করা যায়নি।';
    try {
      const data = await res.json();
      if (data?.error) errMsg = data.error;
    } catch {
      // ignore json parse failure
    }
    throw new Error(errMsg);
  }

  const downloadEndpoint = `${basePath}?name=${encodeURIComponent(fileName || 'flash_file.bin')}`;
  const link = document.createElement('a');
  link.href = downloadEndpoint;
  link.setAttribute('download', fileName || 'flash_file.bin');
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

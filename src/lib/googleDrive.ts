const DRIVE_FOLDER_NAME = 'Jonnoi Telecom - Flash Files';

export interface DriveUploadResult {
  driveFileId: string;
  fileName: string;
  fileSizeBytes: number;
  downloadUrl: string;
  viewUrl: string;
}

export interface DriveStorageInfo {
  userEmail: string;
  userName: string;
  usageBytes: number;
  limitBytes: number | null;
}

export async function getDriveStorageInfo(
  accessToken: string
): Promise<DriveStorageInfo> {
  const res = await fetch(
    'https://www.googleapis.com/drive/v3/about?fields=storageQuota,user',
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Google Drive info failed (${res.status}): ${errText}`);
  }
  const data = await res.json();
  return {
    userEmail: data.user?.emailAddress || '',
    userName: data.user?.displayName || '',
    usageBytes: Number(data.storageQuota?.usage || 0),
    limitBytes: data.storageQuota?.limit ? Number(data.storageQuota.limit) : null,
  };
}

export async function ensureAppFolder(accessToken: string): Promise<string> {
  const query = encodeURIComponent(
    `name = '${DRIVE_FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
  );
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)&pageSize=5`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  if (!searchRes.ok) {
    const errText = await searchRes.text();
    throw new Error(`Could not inspect Google Drive folders (${searchRes.status}): ${errText}`);
  }
  const searchData = await searchRes.json();
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id as string;
  }

  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: DRIVE_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });
  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Could not create Drive folder (${createRes.status}): ${errText}`);
  }
  const folder = await createRes.json();
  return folder.id as string;
}

export async function setDrivePublicPermission(
  accessToken: string,
  driveFileId: string,
  makePublic: boolean
): Promise<void> {
  if (makePublic) {
    const permRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveFileId)}/permissions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role: 'reader',
          type: 'anyone',
        }),
      }
    );
    if (!permRes.ok) {
      const errText = await permRes.text();
      throw new Error(`Failed to set public Drive permission (${permRes.status}): ${errText}`);
    }
  } else {
    const listRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveFileId)}/permissions?fields=permissions(id,type)`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    if (!listRes.ok) return;
    const listData = await listRes.json();
    const anyonePerm = (listData.permissions || []).find(
      (p: { id: string; type: string }) => p.type === 'anyone'
    );
    if (anyonePerm) {
      await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveFileId)}/permissions/${encodeURIComponent(anyonePerm.id)}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
    }
  }
}

export async function uploadFileToDrive(params: {
  accessToken: string;
  file: File;
  folderId: string;
  makePublic: boolean;
  onProgress?: (percent: number) => void;
}): Promise<DriveUploadResult> {
  const { accessToken, file, folderId, makePublic, onProgress } = params;

  const metadata = {
    name: file.name,
    parents: [folderId],
  };

  const initRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,size,webContentLink,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': file.type || 'application/octet-stream',
        'X-Upload-Content-Length': String(file.size),
      },
      body: JSON.stringify(metadata),
    }
  );

  if (!initRes.ok) {
    const errText = await initRes.text();
    throw new Error(`Drive upload initialization failed (${initRes.status}): ${errText}`);
  }

  const uploadUrl = initRes.headers.get('Location');
  if (!uploadUrl) {
    throw new Error('Google Drive did not return a resumable upload session URL.');
  }

  const uploadedFile = await new Promise<{
    id: string;
    name: string;
    size?: string;
    webContentLink?: string;
    webViewLink?: string;
  }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl, true);
    xhr.setRequestHeader(
      'Content-Type',
      file.type || 'application/octet-stream'
    );

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        const pct = Math.min(99, Math.round((event.loaded / event.total) * 100));
        onProgress(pct);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const parsed = JSON.parse(xhr.responseText);
          if (onProgress) onProgress(100);
          resolve(parsed);
        } catch {
          reject(new Error('Invalid JSON response from Google Drive upload.'));
        }
      } else {
        reject(new Error(`Google Drive upload failed (${xhr.status}): ${xhr.responseText}`));
      }
    };

    xhr.onerror = () => {
      reject(new Error('Network error occurred while uploading file to Google Drive.'));
    };

    xhr.send(file);
  });

  if (makePublic) {
    await setDrivePublicPermission(accessToken, uploadedFile.id, true);
  }

  const driveFileId = uploadedFile.id;
  const downloadUrl =
    uploadedFile.webContentLink ||
    `https://drive.google.com/uc?export=download&id=${driveFileId}`;
  const viewUrl =
    uploadedFile.webViewLink ||
    `https://drive.google.com/file/d/${driveFileId}/view`;

  return {
    driveFileId,
    fileName: uploadedFile.name || file.name,
    fileSizeBytes: Number(uploadedFile.size || file.size),
    downloadUrl,
    viewUrl,
  };
}

export async function deleteDriveFile(
  accessToken: string,
  driveFileId: string
): Promise<void> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveFileId)}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  if (!res.ok && res.status !== 404) {
    const errText = await res.text();
    throw new Error(`Failed to delete file from Google Drive (${res.status}): ${errText}`);
  }
}

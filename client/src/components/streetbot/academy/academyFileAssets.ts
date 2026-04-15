export type AcademyFileAsset = {
  url: string;
  filename: string;
  sizeBytes: number;
  mimeType: string;
  uploadedAt: string;
};

export async function fileToAcademyAsset(file: File): Promise<AcademyFileAsset> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });

  return {
    url: dataUrl,
    filename: file.name,
    sizeBytes: file.size,
    mimeType: file.type || "application/octet-stream",
    uploadedAt: new Date().toISOString(),
  };
}

export function downloadAcademyAsset(asset: Partial<AcademyFileAsset>) {
  if (!asset.url) {
    return;
  }

  const anchor = document.createElement("a");
  anchor.href = asset.url;
  anchor.download = asset.filename || "street-voices-academy-file";
  anchor.rel = "noopener noreferrer";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}

export function openAcademyAsset(asset: Partial<AcademyFileAsset>) {
  if (!asset.url) {
    return;
  }

  const opened = window.open(asset.url, "_blank", "noopener,noreferrer");
  if (!opened) {
    downloadAcademyAsset(asset);
  }
}

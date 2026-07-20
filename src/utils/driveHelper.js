/**
 * Transforms a standard Google Drive web link into a direct asset rendering link
 */
export function convertDriveUrl(url) {
  if (!url) return '';
  
  // Regex to extract the unique file ID from common Google Drive link structures
  const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/) || url.match(/id=([a-zA-Z0-9-_]+)/);
  
  if (match && match[1]) {
    const fileId = match[1];
    // Returns the direct web-render link format
    return `https://lh3.googleusercontent.com/d/${fileId}`;
  }
  
  return url; // Return original if it doesn't match Google Drive formats
}
/**
 * Compresses an image file by resizing it to a maximum width and converting it to grayscale.
 * Also handles HEIC/HEIF format conversion to JPEG.
 *
 * @param file The input image file.
 * @param maxWidth The maximum width for the resized image (default: 1000px).
 * @returns A Promise that resolves to the compressed File object.
 */
export async function compressImage(file: File, maxWidth: number = 1000): Promise<File> {
  // Check if code is running in browser environment
  if (typeof window === 'undefined') {
    throw new Error('compressImage can only be used in the browser environment.');
  }

  let imageFile = file;

  // Handle HEIC/HEIF format
  const isHeic = file.type === 'image/heic' ||
                 file.type === 'image/heif' ||
                 file.name.toLowerCase().endsWith('.heic') ||
                 file.name.toLowerCase().endsWith('.heif');

  if (isHeic) {
    try {
      // Dynamic import to avoid SSR issues and handle potential missing types
      // @ts-ignore
      const heic2anyModule = await import('heic2any');
      const heic2any = heic2anyModule.default || heic2anyModule;

      const convertedBlob = await (heic2any as any)({
        blob: file,
        toType: 'image/jpeg',
        quality: 0.8,
      });

      // heic2any can return a single blob or an array of blobs. We handle both.
      const blob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
      imageFile = new File([blob], file.name.replace(/\.(heic|heif)$/i, '.jpg'), { type: 'image/jpeg' });
    } catch (error) {
      console.error('Error converting HEIC image:', error);
      throw new Error('Failed to convert HEIC image.');
    }
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(imageFile);

    img.onload = () => {
      // Revoke the object URL to free memory
      URL.revokeObjectURL(objectUrl);

      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      // Calculate new dimensions
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context.'));
        return;
      }

      // Apply grayscale filter
      ctx.filter = 'grayscale(100%)';

      // Draw image on canvas
      ctx.drawImage(img, 0, 0, width, height);

      // Convert canvas to Blob (JPEG)
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Failed to compress image.'));
            return;
          }
          // Create a new File object
          const newFile = new File([blob], file.name.replace(/\.[^/.]+$/, ".jpg"), {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });
          resolve(newFile);
        },
        'image/jpeg',
        0.8 // Quality
      );
    };

    img.onerror = (error) => {
      URL.revokeObjectURL(objectUrl);
      reject(error);
    };

    img.src = objectUrl;
  });
}

/**
 * Utilitaire de redimensionnement et de compression d'images de reçus
 * Spécifications :
 * - Dimensions maximales : 600px (largeur ou hauteur)
 * - Format : image/jpeg
 * - Qualité : 0.5
 * - Garantit un poids < 100 KB pour respecter strictement la limite Firestore
 */

export async function compressReceiptImage(
  input: File | Blob | string,
  maxDimension = 600,
  quality = 0.5
): Promise<string> {
  return new Promise((resolve) => {
    try {
      if (!input) {
        resolve('');
        return;
      }

      // Si c'est une chaîne de texte qui n'est pas une image (ex: simple code de transaction Wave 'WAVE-1234')
      if (typeof input === 'string') {
        const isDataUrl = input.startsWith('data:image/');
        const isRawBase64 =
          input.startsWith('/9j/') ||
          input.startsWith('iVBORw0KGgo') ||
          input.startsWith('R0lGOD') ||
          input.startsWith('UklGR');
        const isHttpUrl =
          input.startsWith('http://') ||
          input.startsWith('https://') ||
          input.startsWith('blob:');

        if (!isDataUrl && !isRawBase64 && !isHttpUrl) {
          resolve(input);
          return;
        }
      }

      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        try {
          let { width, height } = img;

          // Redimensionnement proportionnel (max 600px)
          if (width > maxDimension || height > maxDimension) {
            if (width >= height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          // Dessin sur Canvas et compression JPEG à 0.5
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, width);
          canvas.height = Math.max(1, height);

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(typeof input === 'string' ? input : '');
            return;
          }

          // Fond blanc pour éviter le noir lors de la conversion PNG -> JPEG
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(compressedDataUrl);
        } catch (canvasErr) {
          console.warn('Canvas export failed, returning fallback:', canvasErr);
          resolve(typeof input === 'string' ? input : '');
        }
      };

      img.onerror = (err) => {
        console.warn("Impossible de charger l'image pour compression:", err);
        resolve(typeof input === 'string' ? input : '');
      };

      if (typeof input === 'string') {
        if (input.startsWith('data:') || input.startsWith('http') || input.startsWith('blob')) {
          img.src = input;
        } else {
          // Format base64 sans préfixe data:image
          img.src = `data:image/jpeg;base64,${input}`;
        }
      } else {
        const reader = new FileReader();
        reader.onload = (e) => {
          img.src = (e.target?.result as string) || '';
        };
        reader.onerror = () => resolve('');
        reader.readAsDataURL(input);
      }
    } catch (e) {
      console.warn('Erreur globale compressReceiptImage:', e);
      resolve(typeof input === 'string' ? input : '');
    }
  });
}

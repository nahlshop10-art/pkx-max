import { encode } from '@jsquash/webp';
import { init as initWebpEncode } from '@jsquash/webp/encode';
import webpWasmUrl from '@jsquash/webp/codec/enc/webp_enc.wasm?url';
import webpSimdWasmUrl from '@jsquash/webp/codec/enc/webp_enc_simd.wasm?url';

import resize, { initResize } from '@jsquash/resize';
import resizeWasmUrl from '@jsquash/resize/lib/resize/pkg/squoosh_resize_bg.wasm?url';

let inited = false;

async function initAll() {
  if (inited) return;
  await Promise.all([
    initWebpEncode({
      locateFile: (path: string) => {
        if (path.includes('webp_enc_simd.wasm')) return webpSimdWasmUrl;
        if (path.includes('webp_enc.wasm')) return webpWasmUrl;
        return path;
      }
    }),
    initResize(resizeWasmUrl)
  ]);
  inited = true;
}

self.onmessage = async (e: MessageEvent) => {
  const { id, width, height, buffer, options, task } = e.data;
  
  try {
    if (task === 'optimize') {
      await initAll();
      
      let finalImageData = new ImageData(new Uint8ClampedArray(buffer), width, height);
      
      // Resize
      if (options.resize && (options.resize.width !== width || Math.round(options.resize.height) !== height)) {
        finalImageData = await resize(finalImageData, { 
          width: options.resize.width, 
          height: Math.round(options.resize.height)
        });
      }
      
      // Encode
      const webpBuffer = await encode(finalImageData, {
        quality: options.quality || 75
      });
      
      self.postMessage({ 
        id, 
        success: true, 
        buffer: webpBuffer, 
        width: finalImageData.width, 
        height: finalImageData.height 
      }, {
        transfer: [webpBuffer]
      });
    }
  } catch (error: any) {
    self.postMessage({ id, success: false, error: error.message || String(error) });
  }
};

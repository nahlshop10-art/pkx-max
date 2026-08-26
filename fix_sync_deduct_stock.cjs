const fs = require('fs');
const content = fs.readFileSync('functions/api/sync_deduct_stock.ts', 'utf8');
const replacement = `                      let customDomain = env.R2_PUBLIC_DOMAIN || 'cdn.flixomart.store';
                      customDomain = customDomain.replace(/^https?:\\/\\//, '').replace(/\\/$/, '');
                      const originBase = customDomain ? 'https://' + customDomain : origin;
                      
                      const broadcastProducts = modifiedProducts.map(p => {
                          const pCopy = { ...p };
                          if (pCopy.image && pCopy.image.startsWith('/')) pCopy.image = originBase + pCopy.image;
                          if (pCopy.images) pCopy.images = pCopy.images.map((img: string) => img.startsWith('/') ? originBase + img : img);
                          return pCopy;
                      });`;
const target = `                      const broadcastProducts = modifiedProducts.map(p => {
                          const pCopy = { ...p };
                          if (pCopy.image && pCopy.image.startsWith('/')) pCopy.image = origin + pCopy.image;
                          if (pCopy.images) pCopy.images = pCopy.images.map((img: string) => img.startsWith('/') ? origin + img : img);
                          return pCopy;
                      });`;
fs.writeFileSync('functions/api/sync_deduct_stock.ts', content.replace(target, replacement));

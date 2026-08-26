import { getCustomDomain } from './_domain';
export async function onRequestPost({ request, env }: any) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return new Response('Missing or invalid file', { status: 400 });
    }

    // Generate unique key using timestamp and uuid
    const ext = file.name.split('.').pop() || 'webp';
    const key = `uploads/img_${Date.now()}_${crypto.randomUUID()}.${ext}`;

    const buffer = await file.arrayBuffer();
    
    // Upload to R2 Bucket
    if (!env.BUCKET) {
      throw new Error('R2 BUCKET binding is not configured. Please bind your R2 bucket to the BUCKET variable in Cloudflare Pages settings.');
    }
    
    await env.BUCKET.put(key, buffer, {
      httpMetadata: {
        contentType: file.type || 'image/webp',
        cacheControl: 'public, max-age=31536000, immutable'
      }
    });

    // Determine the public URL path. 
    // Usually R2 is exposed via a custom domain. For this setup, we'll return the key.
    // In frontend, you'll prepend your R2 custom domain. Let's return a relative path or full domain if defined.
    const customDomain = getCustomDomain(env);
    const url = `https://${customDomain}/${key}`;

    return Response.json({ success: true, url, key });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}

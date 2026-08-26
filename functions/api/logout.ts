export async function onRequestPost() {
    return new Response(JSON.stringify({ success: true }), {
        headers: {
            'Set-Cookie': 'admin_token=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0',
            'Content-Type': 'application/json'
        }
    });
}

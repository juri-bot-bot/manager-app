// api/auth/callback.js
// GoogleOAuth認証のコールバック処理

export default async function handler(req, res) {
  const { code } = req.query;

  if (!code) {
    return res.status(400).json({ error: 'No code provided' });
  }

  const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
  const REDIRECT_URI = 'https://manager-app-pied.vercel.app/api/auth/callback';

  try {
    // 認証コードをアクセストークンに交換
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok) {
      console.error('Token exchange error:', tokenData);
      return res.status(500).json({ error: 'Token exchange failed', detail: tokenData });
    }

    const { access_token, refresh_token } = tokenData;

    // トークンをクエリパラメータでフロントに渡す
    const redirectUrl = new URL('https://manager-app-pied.vercel.app');
    redirectUrl.searchParams.set('access_token', access_token);
    if (refresh_token) {
      redirectUrl.searchParams.set('refresh_token', refresh_token);
    }

    return res.redirect(302, redirectUrl.toString());
  } catch (err) {
    console.error('Auth callback error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

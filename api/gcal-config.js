// api/gcal-config.js
// フロントエンドにGoogle Client IDを返す（シークレットは返さない）

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return res.status(500).json({ error: 'GOOGLE_CLIENT_ID not configured' });
  }

  return res.status(200).json({ clientId });
}

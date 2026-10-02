// api/save-token.js
// GoogleカレンダーのアクセストークンをVercel環境変数に保存する

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { accessToken, refreshToken } = req.body;
  if (!accessToken) return res.status(400).json({ error: 'accessToken required' });

  const vercelToken = process.env.VERCEL_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;

  if (!vercelToken || !projectId) {
    return res.status(500).json({ error: 'Vercel credentials not configured' });
  }

  try {
    // アクセストークンを保存
    await upsertEnvVar(vercelToken, projectId, 'GCAL_ACCESS_TOKEN', accessToken);

    // リフレッシュトークンがあれば保存
    if (refreshToken) {
      await upsertEnvVar(vercelToken, projectId, 'GCAL_REFRESH_TOKEN', refreshToken);
    }

    return res.status(200).json({ success: true });
  } catch (e) {
    console.error('Save token error:', e);
    return res.status(500).json({ error: e.message });
  }
}

async function upsertEnvVar(token, projectId, key, value) {
  // まず既存の環境変数一覧を取得
  const listRes = await fetch(
    `https://api.vercel.com/v9/projects/${projectId}/env`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const listData = await listRes.json();
  const existing = (listData.envs || []).find(e => e.key === key);

  if (existing) {
    // 既存なら更新
    await fetch(
      `https://api.vercel.com/v9/projects/${projectId}/env/${existing.id}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ value }),
      }
    );
  } else {
    // 新規作成
    await fetch(
      `https://api.vercel.com/v9/projects/${projectId}/env`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          key,
          value,
          type: 'encrypted',
          target: ['production'],
        }),
      }
    );
  }
}
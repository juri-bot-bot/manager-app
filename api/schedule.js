export default async function handler(req, res) {
  const redis_url = process.env.KV_REST_API_URL;
  const redis_token = process.env.KV_REST_API_TOKEN;

  async function redisSet(key, value) {
    const r = await fetch(`${redis_url}/set/${key}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${redis_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(value),
    });
    return r.json();
  }

  async function redisGet(key) {
    const r = await fetch(`${redis_url}/get/${key}`, {
      headers: { Authorization: `Bearer ${redis_token}` },
    });
    const data = await r.json();
    return data.result;
  }

  if (req.method === 'POST') {
    const { schedule, bigEvent } = req.body;
    await redisSet('schedule', schedule || '');
    await redisSet('bigEvent', bigEvent || '');
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'GET') {
    const schedule = await redisGet('schedule');
    const bigEvent = await redisGet('bigEvent');
    return res.status(200).json({ schedule, bigEvent });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

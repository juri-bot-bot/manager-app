export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const authHeader = req.headers['authorization'];
  if (!process.env.TEST_SEND_KEY || authHeader !== `Bearer ${process.env.TEST_SEND_KEY}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const apiKey = process.env.ANTHROPIC_KEY;
  const token = process.env.LINE_TOKEN_NAKAMURA;
  const userId = process.env.LINE_USER_ID;
  if (!apiKey || !token || !userId) return res.status(500).json({ error: 'Test credentials missing' });

  try {
    const ai = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6', max_tokens: 120,
        system: 'あなたはSixTONESの女性メンバーのスケジュール担当マネージャー、中村彩です。丁寧で事務的な敬語。短いLINE文を作ってください。',
        messages: [{ role: 'user', content: '通知システムのテスト送信です。テストだと明確にわかる短いメッセージを1通作ってください。' }]
      })
    });
    const aiData = await ai.json();
    if (!ai.ok || !aiData.content?.[0]?.text) throw new Error(`AI generation failed: HTTP ${ai.status}`);
    const message = '[通知テスト] ' + aiData.content[0].text;

    const line = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ to: userId, messages: [{ type: 'text', text: message }] })
    });
    if (!line.ok) throw new Error(`LINE push failed: HTTP ${line.status} ${await line.text()}`);
    console.log('TEST LINE push succeeded: manager=n Nakamura; AI generated');
    return res.status(200).json({ ok: true, aiGenerated: true, lineAccepted: true, testMessage: message });
  } catch (e) {
    console.error('TEST LINE send failed:', e);
    return res.status(500).json({ error: e.message });
  }
}
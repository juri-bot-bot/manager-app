// api/calendar.js
// Googleカレンダーの予定を取得する

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No access token' });
  }

  const accessToken = authHeader.replace('Bearer ', '');

  // 今日から30日分の予定を取得
  const now = new Date();
  const thirtyDaysLater = new Date();
  thirtyDaysLater.setDate(now.getDate() + 30);

  const params = new URLSearchParams({
    timeMin: now.toISOString(),
    timeMax: thirtyDaysLater.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '50',
  });

  try {
    const calRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const calData = await calRes.json();

    if (!calRes.ok) {
      console.error('Calendar API error:', calData);
      return res.status(500).json({ error: 'Calendar API error', detail: calData });
    }

    // 必要な情報だけ整形して返す
    const events = (calData.items || []).map(event => ({
      title: event.summary || '（タイトルなし）',
      date: event.start.date || event.start.dateTime?.split('T')[0],
      time: event.start.dateTime
        ? new Date(event.start.dateTime).toLocaleTimeString('ja-JP', {
            hour: '2-digit',
            minute: '2-digit',
          })
        : null,
      location: event.location || null,
    }));

    return res.status(200).json({ events });
  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

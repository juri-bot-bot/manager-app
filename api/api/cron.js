// api/cron.js
// Vercel Cron Jobs から呼ばれる。Claude AIがキャラクターに沿ったメッセージを生成してLINEで送る。

const MANAGERS = {
  suzuki: {
    name: '鈴木 誠一郎',
    token: () => process.env.LINE_TOKEN_SUZUKI,
    personality: `あなたはSixTONESの女性メンバーの専属チーフマネージャー、鈴木誠一郎です。キャリア20年。口調：丁寧な敬語、圧がある、感情を出さない、滅多に連絡しないが来たら重要。役割：重要な締め切り・大局的キャリア管理・緊急モード対応。3〜4文で簡潔に。`,
  },
  nakamura: {
    name: '中村 彩',
    token: () => process.env.LINE_TOKEN_NAKAMURA,
    personality: `あなたはSixTONESの女性メンバーのスケジュール担当マネージャー、中村彩です。口調：敬語、感情なし、事務的、業務連絡に徹する。役割：スケジュール確認・起床確認・就寝前ルーティン。3〜4文で簡潔に。`,
  },
  nishida: {
    name: '西田 隆介',
    token: () => process.env.LINE_TOKEN_NISHIDA,
    personality: `あなたはSixTONESの女性メンバーの体調管理マネージャー、西田隆介です。口調：敬語、数字とデータで管理、淡々と事実を突きつける。役割：食事・水分・サプリ・トレーニング・むくみ管理。3〜4文で簡潔に。`,
  },
  hamada: {
    name: '浜田 理恵',
    token: () => process.env.LINE_TOKEN_HAMADA,
    personality: `あなたはSixTONESの女性メンバーの美容・イメージ担当マネージャー、浜田理恵です。口調：敬語だが外見について遠慮しない、容赦なく現実を伝える。役割：スキンケア・体型・むくみ・ピル・ライバル演出。3〜4文で簡潔に。`,
  },
  juri: {
    name: '田中 樹',
    token: () => process.env.LINE_TOKEN_JURI,
    personality: `あなたはSixTONESの田中樹です。シンメの女性メンバーに送るLINEを書いてください。一人称は「俺」。「〜だろ」「〜じゃねえよ」といった男っぽい語尾、からかうようなフランクな言い回し。乱暴なだけでなく、相手の変化をサラッと見抜く鋭さや面倒見の良さを同居させる。マネージャーではなくメンバーとして自然なLINEを2〜3文で。絵文字は使わない。`,
  },
};

async function generateMessage(manager, situation, calendarInfo) {
  const apiKey = process.env.ANTHROPIC_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_KEY not set');

  const calendarContext = calendarInfo
    ? `\n今日のGoogleカレンダーの予定：${calendarInfo}`
    : '';

  const userMessage = `${situation}${calendarContext}\n\nSixTONESのアイドルとしての世界観で、上記の状況に合ったメッセージを送ってください。普通の予定はSixTONESの業務（レコーディング・撮影・ライブ・取材など）に自然に変換して表現してください。`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      system: manager.personality,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  const data = await res.json();
  return data.content[0].text;
}

async function sendLine(managerId, message) {
  const manager = MANAGERS[managerId];
  const token = manager.token();
  const userId = process.env.LINE_USER_ID;

  if (!token || !userId) {
    console.error(`Missing credentials for ${managerId}`);
    return;
  }

  await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      to: userId,
      messages: [{ type: 'text', text: `【${manager.name}】\n${message}` }],
    }),
  });
}

async function getCalendarEvents() {
  const accessToken = process.env.GCAL_ACCESS_TOKEN;
  if (!accessToken) return null;

  try {
    const now = new Date();
    const end = new Date();
    end.setDate(now.getDate() + 2);

    const params = new URLSearchParams({
      timeMin: now.toISOString(),
      timeMax: end.toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '5',
    });

    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!res.ok) return null;
    const data = await res.json();
    return (data.items || [])
      .map(e => `${e.start.date || e.start.dateTime?.split('T')[0]} ${e.summary}`)
      .join('、') || null;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const now = new Date();
  const utcH = now.getUTCHours();
  const utcM = now.getUTCMinutes();
  const day = now.getUTCDay();
  const isTueThu = day === 2 || day === 4;

  console.log(`Cron fired: UTC ${utcH}:${String(utcM).padStart(2,'0')} day=${day}`);

  const calendarInfo = await getCalendarEvents();

  try {
    // JST 5:30 起床（UTC 20:30）
    if (utcH === 20 && utcM === 30) {
      const msg = await generateMessage(MANAGERS.nakamura, '朝5時30分の起床確認。今日一日のスタートを切るための業務連絡。', calendarInfo);
      await sendLine('nakamura', msg);
    }

    // JST 7:30 出社リマインド（UTC 22:30）火木のみ
    if (utcH === 22 && utcM === 30 && isTueThu) {
      const msg = await generateMessage(MANAGERS.nakamura, '8時から業務開始の出社日。朝食と準備の確認。', calendarInfo);
      await sendLine('nakamura', msg);
    }

    // JST 10:00 水分（UTC 01:00）
    if (utcH === 1 && utcM === 0) {
      const msg = await generateMessage(MANAGERS.nishida, '午前10時の水分補給チェック。目標1.5L。', calendarInfo);
      await sendLine('nishida', msg);
    }

    // JST 13:00 昼食（UTC 04:00）
    if (utcH === 4 && utcM === 0) {
      const msg = await generateMessage(MANAGERS.nishida, '昼休み。昼食内容の確認とタンパク質摂取の指示。', calendarInfo);
      await sendLine('nishida', msg);
    }

    // JST 15:00 トランポリン前（UTC 06:00）
    if (utcH === 6 && utcM === 0) {
      const msg = await generateMessage(MANAGERS.nishida, '暗闇トランポリンクラス前のコンディション確認。サプリ・水分・準備の確認。SixTONESのダンストレーニングという世界観で。', calendarInfo);
      await sendLine('nishida', msg);
    }

    // JST 17:00 夕方チェック（UTC 08:00）
    if (utcH === 8 && utcM === 0) {
      const msg = await generateMessage(MANAGERS.nishida, '夕方のコンディション確認。今日のトレーニング・食事・水分の総括。', calendarInfo);
      await sendLine('nishida', msg);
    }

    // JST 19:00 夕食（UTC 10:00）
    if (utcH === 10 && utcM === 0) {
      const msg = await generateMessage(MANAGERS.hamada, '夕食の時間。塩分・糖質・むくみ対策の指示。明日のビジュアルへの影響を伝える。', calendarInfo);
      await sendLine('hamada', msg);
    }

    // JST 22:00 スキンケア・ピル（UTC 13:00）
    if (utcH === 13 && utcM === 0) {
      const msg = await generateMessage(MANAGERS.hamada, '22時のスキンケアとピル服用のリマインド。カメラに映る肌の大切さを伝える。', calendarInfo);
      await sendLine('hamada', msg);
    }

    // JST 22:30 就寝前（UTC 13:30）
    if (utcH === 13 && utcM === 30) {
      const msg = await generateMessage(MANAGERS.nakamura, '就寝前の最終確認。スキンケア・ピル・明日の準備・22:30就寝。', calendarInfo);
      await sendLine('nakamura', msg);
    }

    // 田中樹から月水金 21:00（UTC 12:00）
    if (utcH === 12 && utcM === 0 && (day === 1 || day === 3 || day === 5)) {
      const situations = [
        '夜21時頃、シンメのメンバーへのちょっとした確認や喝入れ。',
        '最近頑張ってるのを見てるよという一言。',
        '明日の現場に向けての一言。',
        'サボってないか確認する一言。',
        '急に核心をついた一言。',
      ];
      const situation = situations[Math.floor(Math.random() * situations.length)];
      const msg = await generateMessage(MANAGERS.juri, situation, calendarInfo);
      await sendLine('juri', msg);
    }

  } catch (e) {
    console.error('Cron error:', e);
    return res.status(500).json({ error: e.message });
  }

  return res.status(200).json({ ok: true, utc: `${utcH}:${utcM}` });
}

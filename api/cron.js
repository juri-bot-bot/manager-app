// api/cron.js
// Best-effort shared deduplication. If KV DNS/service is down, fail open so notifications continue.
const localCronSlots = new Map();
async function claimCronSlot(slot) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return localClaim(slot);

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'text/plain',
      },
      body: `SET ${slot} 1 NX EX 86400`,
    });
  } catch (error) {
    console.error('KV REST network error; using local dedupe:', error);
    return localClaim(slot);
  }

  if (!response.ok) {
    const detail = await response.text();
    console.error(`KV REST unavailable (${response.status}); using local dedupe: ${detail}`);
    return localClaim(slot);
  }

  const result = await response.json();
  if (result.result === 'OK') return true;
  if (result.result === null) return false;
  console.error('Unexpected KV REST response; using local dedupe');
  return localClaim(slot);
}

function localClaim(slot) {
  const now = Date.now();
  for (const [key, expires] of localCronSlots) if (expires <= now) localCronSlots.delete(key);
  if (localCronSlots.has(slot)) return false;
  localCronSlots.set(slot, now + 5 * 60 * 1000);
  console.warn('Cron dedupe using instance-local fallback:', slot);
  return true;
}
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
    personality: `あなたはSixTONESの田中樹です。シンメの女性メンバーに送るLINEを書いてください。一人称は「俺」。普段は今まで通り、男っぽくフランクで軽くからかったりツッコんだりする自然なLINE。「〜だろ」「〜じゃねえよ」など。相手の変化に気づく鋭さと面倒見の良さはあるが、基本は照れ隠しも含めて素っ気ないくらいの通常テンション。たまにだけ、さりげないデレや優しさを混ぜる（頻度は5回に1回程度。毎回甘くしない、告白調や過剰な恋愛表現は避ける）。マネージャーではなくメンバーとして自然なLINEを2〜3文で。絵文字は使わない。`,
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
      system: manager.personality + `\n\n【LINEメッセージの絶対ルール】\n- 送信文には「マネージャー」「担当」「スタッフ」など自分の立場を説明する言葉を入れない。\n- 「樹」「田中樹」など自分の名前や名乗り、署名を一切入れない。相手の名前も呼びかけに使わない。\n- 「マネージャーから」「連絡です」「通知」「リマインドです」など、システムや役割が透ける言い方を避ける。\n- まるで普段からLINEで会話している人が、その時ふと思って送った自然な文章にする。\n- 堅い説明文・箇条書き・定型文・AIっぽい締めは禁止。必要な内容だけ自然な会話として伝える。\n- 出力するのは送信する本文だけ。前置きや解説は不要。`,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${data.error?.message || 'request failed'}`);
  if (!data.content?.[0]?.text) throw new Error('Anthropic response had no text content');
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

  const response = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      to: userId,
      messages: [{ type: 'text', text: message }],
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`LINE push failed (${response.status}): ${detail}`);
  }
  console.log(`LINE push succeeded for ${managerId}`);
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
  // Atomically suppress duplicate invocations of the same UTC minute.
  const cronSlot = `line-cron:${now.toISOString().slice(0, 16)}`;
  try {
    const claimed = await claimCronSlot(cronSlot);
    if (!claimed) {
      console.log('Duplicate cron invocation suppressed:', cronSlot);
      return res.status(200).json({ ok: true, duplicate: true });
    }
  } catch (e) {
    console.error('Cron deduplication unavailable:', e);
    return res.status(503).json({ error: 'Deduplication unavailable' });
  }

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

    // 田中樹から週4回、21:00 JST（UTC 12:00）。普段は通常テンション、たまにだけデレ。
    if (utcH === 12 && utcM === 0 && (day === 1 || day === 3 || day === 5 || day === 0)) {
      const situations = [
        '夜21時頃、シンメのメンバーへのちょっとした確認や軽いツッコミ。',
        '最近頑張ってるのを見てるけど、わざわざ大げさに褒めない一言。',
        '明日の現場に向けた普段通りの短い一言。',
        'サボってないか軽くいじりながら確認する一言。',
        'ふとした気遣いを照れ隠しっぽく伝える一言。',
        'たまにだけ、いつもより少し優しくなる一言。',
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

// api/cron.js
// Vercel Cron Jobs から呼ばれる。時間に応じてLINE通知を送る。
// 時刻はUTC（日本時間 = UTC+9）

async function sendLine(managerId, message) {
  const tokens = {
    suzuki:   process.env.LINE_TOKEN_SUZUKI   || process.env.LINE_ACCESS_TOKEN,
    nakamura: process.env.LINE_TOKEN_NAKAMURA || process.env.LINE_ACCESS_TOKEN,
    nishida:  process.env.LINE_TOKEN_NISHIDA  || process.env.LINE_ACCESS_TOKEN,
    hamada:   process.env.LINE_TOKEN_HAMADA   || process.env.LINE_ACCESS_TOKEN,
  };

  const token = tokens[managerId];
  const userId = process.env.LINE_USER_ID;

  if (!token || !userId) {
    console.error('LINE credentials missing');
    return;
  }

  const names = {
    suzuki: '鈴木 誠一郎',
    nakamura: '中村 彩',
    nishida: '西田 隆介',
    hamada: '浜田 理恵',
  };

  await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      to: userId,
      messages: [{ type: 'text', text: `【${names[managerId]}】\n${message}` }],
    }),
  });
}

export default async function handler(req, res) {
  // Vercel Cron の認証確認
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // 現在のUTC時刻を取得
  const now = new Date();
  const utcH = now.getUTCHours();
  const utcM = now.getUTCMinutes();
  const day = now.getUTCDay(); // 0=日 1=月 2=火 3=水 4=木 5=金 6=土
  const isTueThu = day === 2 || day === 4;

  console.log(`Cron fired: UTC ${utcH}:${String(utcM).padStart(2,'0')} day=${day}`);

  // UTC→JST対応表
  // JST 5:30  = UTC 20:30 前日
  // JST 6:00  = UTC 21:00 前日
  // JST 7:30  = UTC 22:30 前日（出社日のみ）
  // JST 10:00 = UTC 01:00
  // JST 13:00 = UTC 04:00
  // JST 15:00 = UTC 06:00
  // JST 17:00 = UTC 08:00
  // JST 19:00 = UTC 10:00
  // JST 22:00 = UTC 13:00
  // JST 22:30 = UTC 13:30

  // JST 5:30 起床（UTC 20:30）
  if (utcH === 20 && utcM === 30) {
    await sendLine('nakamura', 'おはようございます。5時30分です。本日のスケジュールを確認してください。今日も現場に向けて最高のコンディションで臨んでください。');
  }

  // JST 7:30 出社リマインド（UTC 22:30）火木のみ
  if (utcH === 22 && utcM === 30 && isTueThu) {
    await sendLine('nakamura', '8時から業務開始です。朝食は摂りましたか。移動中の水分補給も忘れずに。');
  }

  // JST 10:00 水分（UTC 01:00）
  if (utcH === 1 && utcM === 0) {
    await sendLine('nishida', '水分補給の時間です。現時点で500ml以上飲めていますか。本番で最高のパフォーマンスを出すには水分管理が基本です。目標1.5Lです。');
  }

  // JST 13:00 昼食（UTC 04:00）
  if (utcH === 4 && utcM === 0) {
    await sendLine('nishida', 'お昼の時間です。昼食の内容を意識してください。午前中のトレーニング・水分摂取の状況も確認します。タンパク質をしっかり摂ってください。');
  }

  // JST 15:00 トランポリン前確認（UTC 06:00）
  if (utcH === 6 && utcM === 0) {
    await sendLine('nishida', 'ダンストレーニングの前確認です。サプリは飲みましたか。水分・軽い補食も済ませてください。今日のクラスで全力を出すための準備を整えてください。');
  }

  // JST 17:00 夕方チェック（UTC 08:00）
  if (utcH === 8 && utcM === 0) {
    await sendLine('nishida', '夕方のコンディション確認です。今日のトレーニング・食事・水分の状況を報告してください。明日の現場に向けてむくみのケアも始めてください。');
  }

  // JST 19:00 夕食（UTC 10:00）
  if (utcH === 10 && utcM === 0) {
    await sendLine('hamada', '夕食の時間です。塩分・糖質は控えめに。明日のビジュアルはこの食事で決まります。むくみは翌朝の顔に直結します。賢い選択をしてください。');
  }

  // JST 22:00 スキンケア・ピル（UTC 13:00）
  if (utcH === 13 && utcM === 0) {
    await sendLine('hamada', 'スキンケアの時間です。クレンジング・洗顔・保湿を丁寧に。カメラの前に立つ肌は毎日の積み重ねです。ピルも忘れずに服用してください。');
  }

  // JST 22:30 就寝前（UTC 13:30）
  if (utcH === 13 && utcM === 30) {
    await sendLine('nakamura', '就寝前の最終確認です。スキンケア・ピル・明日の準備は完了しましたか。スマホを置いて22:30には就寝してください。明日も現場があります。');
  }

  return res.status(200).json({ ok: true, utc: `${utcH}:${utcM}` });
}

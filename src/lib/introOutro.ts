const FONT = '"Noto Sans JP", "Hiragino Kaku Gothic ProN", sans-serif';

export type BrandOverlayType = 'intro_banner' | 'outro_recap' | 'outro_cta';

export interface IntroOutroConfig {
  channelName: string; // Mặc định: "もしも検証ラボ"
  topicJa: string;     // VD: "家の前に地球の中心まで行けるエレベーターができたら"
  topicVi: string;     // VD: "Nếu trước nhà có thang máy xuống tâm Trái Đất"
  recapJa: string;     // VD: "エレベーターで地球の中心まで行く3日半の旅"
  recapVi: string;     // VD: "chuyến đi thang máy 3,5 ngày xuống tâm Trái Đất"
}

export interface BrandOverlayData {
  type: BrandOverlayType;
  channelName?: string;
  headline?: string;
  subline?: string;
}

/** Tạo sẵn Beat Intro chuẩn để chèn lên đầu mảng beats */
export function buildIntroBeat(cfg: IntroOutroConfig) {
  const ch = cfg.channelName || 'もしも検証ラボ';
  return {
    id: 'beat_intro',
    scene: 'stage_studio',
    cameraPreset: 'front_medium',
    characterAction: 'idle_wave',
    emotion: 'excited',
    env: { timeOfDay: 'day', weather: 'clear', showHole: false },
    brandOverlay: {
      type: 'intro_banner' as BrandOverlayType,
      channelName: ch,
      headline: cfg.topicJa,
      subline: '物理 × 3Dシミュレーション検証',
    },
    vi_note: `Xin chào! Mình là ${ch}. Hôm nay chúng ta sẽ kiểm chứng "${cfg.topicVi}" bằng vật lý và 3D nhé!`,
    ja_narration: `こんにちは！${ch}です。今日は「${cfg.topicJa}」を、物理と3Dで本気検証していきます！`,
    hudStart: { time: '12:00:00', depthKm: 0, speedKmh: 0, progress: 0 },
    hudEnd: { time: '12:00:00', depthKm: 0, speedKmh: 0, progress: 0 },
  };
}

/** Tạo sẵn 2 Beat Outro chuẩn (Tổng kết + Comment, và Like/Sub/Chuông) để chèn cuối mảng beats */
export function buildOutroBeats(cfg: IntroOutroConfig, lastHud?: any) {
  const ch = cfg.channelName || 'もしも検証ラボ';
  const hud = lastHud ?? { time: '12:00:00', depthKm: 0, speedKmh: 0, progress: 1 };

  return [
    {
      id: 'beat_outro_recap',
      scene: 'stage_studio',
      cameraPreset: 'front_medium',
      characterAction: 'point_explain',
      emotion: 'excited',
      env: { timeOfDay: 'sunset', weather: 'clear', showHole: false },
      brandOverlay: {
        type: 'outro_recap' as BrandOverlayType,
        channelName: ch,
        headline: cfg.recapJa,
        subline: '次の検証テーマをコメントで募集中！',
      },
      vi_note: `Hôm nay chúng ta đã kiểm chứng xong "${cfg.recapVi}"! Bạn muốn mình làm chủ đề nào tiếp theo thì comment bên dưới nhé!`,
      ja_narration: `今日は「${cfg.recapJa}」を検証しました！次にやってほしいテーマがあれば、ぜひコメント欄で教えてください！`,
      hudStart: hud,
      hudEnd: hud,
    },
    {
      id: 'beat_outro_cta',
      scene: 'stage_studio',
      cameraPreset: 'front_medium',
      characterAction: 'idle_wave',
      emotion: 'excited',
      env: { timeOfDay: 'sunset', weather: 'clear', showHole: false },
      brandOverlay: {
        type: 'outro_cta' as BrandOverlayType,
        channelName: ch,
        headline: '応援よろしくお願いします！',
        subline: '高評価・チャンネル登録・通知オンが励みになります',
      },
      vi_note: `Nếu thấy thú vị hãy Like, Subscribe và bật chuông thông báo nhé! Đó là động lực lớn nhất cho ${ch}. Hẹn gặp lại tập sau!`,
      ja_narration: `少しでも面白いと思ったら、高評価・チャンネル登録・通知オンをよろしくお願いします！皆さんの応援が、動画作りの一番の励みになります。また次回の検証でお会いしましょう！`,
      hudStart: hud,
      hudEnd: hud,
    },
  ];
}

function easeOutBack(x: number): number {
  const c = Math.max(0, Math.min(1, x));
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(c - 1, 3) + c1 * Math.pow(c - 1, 2);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  startY: number,
  maxWidth: number,
  lineHeight: number
) {
  const chars = Array.from(text);
  let line = '';
  let y = startY;
  for (let i = 0; i < chars.length; i++) {
    const test = line + chars[i];
    if (ctx.measureText(test).width > maxWidth && line.length > 0) {
      ctx.fillText(line, cx, y);
      line = chars[i];
      y += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, cx, y);
}

/** Vẽ Overlay đồ họa cho Intro & Outro trực tiếp lên Canvas 1920x1080 */
export function drawIntroOutroOverlay(
  ctx: CanvasRenderingContext2D,
  overlay: BrandOverlayData,
  beatElapsedSec: number,
  canvasW = 1920,
  canvasH = 1080
) {
  const pop = easeOutBack(Math.min(1, beatElapsedSec / 0.65));
  const cardW = 940;
  const cardH = 520;
  const cardX = canvasW - cardW - 95;
  const cardY = 215;

  ctx.save();
  ctx.globalAlpha = Math.min(1, beatElapsedSec * 2.5);

  // Nền kính mờ đồng bộ với bộ DiagramOverlay
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 36;
  roundRect(ctx, cardX, cardY, cardW, cardH, 24);
  ctx.fillStyle = 'rgba(16, 24, 39, 0.90)';
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Thanh màu cam trên đỉnh
  ctx.fillStyle = '#e67e22';
  roundRect(ctx, cardX + 2, cardY, cardW - 4, 8, 4);
  ctx.fill();

  const cx = cardX + cardW / 2;

  // === 1. INTRO BANNER ===
  if (overlay.type === 'intro_banner') {
    // Badge tên kênh góc trên card
    const badgeW = 360;
    roundRect(ctx, cx - badgeW / 2, cardY + 42, badgeW, 54, 27);
    ctx.fillStyle = '#3b7a75';
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 28px ${FONT}`;
    ctx.fillText(`🔬 ${overlay.channelName || 'もしも検証ラボ'}`, cx, cardY + 79);

    // Nhãn "TODAY'S EXPERIMENT"
    ctx.fillStyle = '#ff9f43';
    ctx.font = `700 28px ${FONT}`;
    ctx.fillText('本日の検証テーマ', cx, cardY + 150);

    // Tiêu đề tập phim tự xuống dòng
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 44px ${FONT}`;
    drawWrappedText(ctx, overlay.headline || '', cx, cardY + 230, cardW - 110, 62);

    // Phụ đề nhỏ bên dưới
    ctx.fillStyle = '#94a3b8';
    ctx.font = `600 26px ${FONT}`;
    ctx.fillText(overlay.subline || '物理 × 3Dシミュレーション検証', cx, cardY + cardH - 48);
  }

  // === 2. OUTRO RECAP + COMMENT ===
  else if (overlay.type === 'outro_recap') {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#38bdf8';
    ctx.font = `700 30px ${FONT}`;
    ctx.fillText('✅ 本日の検証まとめ', cx, cardY + 86);

    ctx.fillStyle = '#ffffff';
    ctx.font = `800 42px ${FONT}`;
    drawWrappedText(ctx, overlay.headline || '', cx, cardY + 170, cardW - 110, 58);

    // Khung kêu gọi Comment nhấp nháy nhẹ
    const pulse = 1 + Math.sin(beatElapsedSec * 4) * 0.02;
    ctx.save();
    ctx.translate(cx, cardY + 395);
    ctx.scale(pulse, pulse);
    roundRect(ctx, -380, -48, 760, 96, 18);
    ctx.fillStyle = 'rgba(230, 126, 34, 0.22)';
    ctx.fill();
    ctx.strokeStyle = '#e67e22';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#ffbe76';
    ctx.font = `700 32px ${FONT}`;
    ctx.fillText('💬 次のテーマはコメント欄へ！', 0, 12);
    ctx.restore();
  }

  // === 3. OUTRO CTA (LIKE + SUBSCRIBE + BELL) ===
  else if (overlay.type === 'outro_cta') {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 40px ${FONT}`;
    ctx.fillText(overlay.channelName || 'もしも検証ラボ', cx, cardY + 84);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = `600 26px ${FONT}`;
    ctx.fillText(overlay.subline || '高評価・チャンネル登録・通知オンが励みになります', cx, cardY + 136);

    // 3 nút CTA xuất hiện lần lượt theo nhịp
    const buttons = [
      { icon: '👍', label: '高評価', sub: 'Like', bg: '#2563eb', delay: 0.15 },
      { icon: '▶', label: 'チャンネル登録', sub: 'Subscribe', bg: '#dc2626', delay: 0.45 },
      { icon: '🔔', label: '通知オン', sub: 'Notify', bg: '#d97706', delay: 0.75 },
    ];

    const btnW = 260;
    const btnH = 190;
    const gap = 30;
    const startX = cx - (btnW * 3 + gap * 2) / 2;
    const btnY = cardY + 205;

    buttons.forEach((b, idx) => {
      const localT = Math.max(0, beatElapsedSec - b.delay);
      const scale = localT > 0 ? easeOutBack(Math.min(1, localT / 0.45)) : 0;
      const glow = 1 + Math.sin(beatElapsedSec * 5 - idx) * 0.03;
      const bx = startX + idx * (btnW + gap) + btnW / 2;
      const by = btnY + btnH / 2;

      if (scale <= 0.01) return;
      ctx.save();
      ctx.translate(bx, by);
      ctx.scale(scale * glow, scale * glow);

      ctx.shadowColor = b.bg;
      ctx.shadowBlur = 18;
      roundRect(ctx, -btnW / 2, -btnH / 2, btnW, btnH, 20);
      ctx.fillStyle = b.bg;
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.font = `700 54px ${FONT}`;
      ctx.fillText(b.icon, 0, -14);

      ctx.font = `800 28px ${FONT}`;
      ctx.fillText(b.label, 0, 42);

      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.font = `600 20px ${FONT}`;
      ctx.fillText(b.sub, 0, 74);

      ctx.restore();
    });

    // Chú thích cảm ơn phía dưới
    ctx.fillStyle = '#ffbe76';
    ctx.font = `700 28px ${FONT}`;
    ctx.fillText('ご視聴ありがとうございました！', cx, cardY + cardH - 36);
  }

  ctx.restore();
}

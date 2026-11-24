# Kai 3D Studio

App dựng video もしも tiếng Nhật: kịch bản song ngữ → giọng Nhật → cảnh 3D + HUD + phụ đề → MP4 1080p.
Bản đang chạy: https://kai-3d-studio.vercel.app/

Next.js 15 · React 19 · three.js 0.170 · Tailwind 3 · mp4-muxer (xuất video ngay trong trình duyệt).

## Chạy trên máy

```powershell
npm install
npm run dev
```

Mở http://localhost:3000. Kiểm tra lỗi kiểu: `npm run typecheck`.

## Deploy lên Vercel

Thư mục đã được liên kết với project `kai-3d-studio` (file `.vercel/project.json`).

```powershell
npx vercel            # bản xem thử (preview URL)
npx vercel --prod     # đưa lên kai-3d-studio.vercel.app
```

## Bảo vệ API giọng đọc

`/api/tts` và `/api/elevenlabs` chỉ nhận yêu cầu gửi từ chính trang app, và giới hạn khoảng 120 lượt / 10 phút cho mỗi IP.
Muốn chặn chặt hơn: vào Vercel → Settings → Environment Variables, thêm `STUDIO_PASSWORD`, deploy lại,
rồi nhập mật khẩu đó ở mục "Mật khẩu studio" trong ô Giọng đọc.

## Cấu trúc

| Thư mục | Nội dung |
| --- | --- |
| `src/app/page.tsx` | Trang chính, giữ state tập phim (lưu localStorage) |
| `src/app/api/tts` | Giọng Edge miễn phí (msedge-tts) |
| `src/app/api/elevenlabs` | Chuyển tiếp yêu cầu ElevenLabs bằng API key của người dùng |
| `src/components/` | 4 panel: Kịch bản, Giọng, Xem trước, Xuất video |
| `src/lib/engine.ts` | Engine three.js: dựng cảnh, camera, nhân vật |
| `src/lib/scenes/` | Từng bối cảnh (Phố Nhật, Đường hầm, Trái Đất, Mặt biển, NY…), preset camera |
| `src/lib/timeline.ts` | Tính thời gian từng beat |
| `src/lib/exporter.ts`, `compositor.ts` | Ghép khung hình + HUD + phụ đề, xuất MP4 |
| `src/lib/types.ts` | Định dạng JSON của tập phim (Episode / Beat) |

## Lấy lại code từ một bản deploy

Nếu có bản deploy mới hơn được đẩy từ nơi khác:

```powershell
npx vercel login
node scripts/pull-from-vercel.mjs <deploymentId>
```

Script ghi đè file khác bản deploy và kiểm tra SHA1 từng file.

## Deploy

Mỗi lần đẩy lên nhánh `main` của repo này, Vercel tự build và cập nhật https://kai-3d-studio.vercel.app.

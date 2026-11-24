# Phong cách kể chuyện cho kịch bản もしも

Dán file này cho Claude mỗi khi nhờ viết JSON tập mới.

Rút ra từ cách kể của video 「家の前の穴に飛び込んだら、地球の反対側まで何分？」 (kênh ほんとにやったら, ~2 triệu view sau 2 tuần).
Chỉ học **cách kể**. Không chép câu chữ, cấu trúc từng cảnh hay đề tài của họ: khán giả Nhật rất hay gọi「パクリ」.

## 12 luật

1. **Mở bằng giờ + nơi chốn, không mở bằng「もしも〜たら」dài.**
   「朝の8時。家の前です。」 Câu đầu không quá 15 chữ. Tiền đề nói ở câu thứ 2–3.
2. **Nêu một điều người ta hay nói rồi đi kiểm chứng.**
   「〜とよく言われます。本当か確かめます。」 Cuối video phải trả lời đúng điều đó.
3. **Đặt luật chơi trước khi đi**: chân không, đồ bảo hộ, "nhân vật không bị thương" (演出).
   Gài một câu chờ: 「理由は、すぐに分かります。」
4. **Đồng hồ là xương sống.** Beat nào cũng mở bằng thời gian / độ sâu / tốc độ: 「22秒。深さ2.3km。」
   HUD trong app (`hudStart` / `hudEnd`) phải khớp đúng con số trong lời đọc.
5. **Câu cực ngắn, giọng bình thản (です/ます).** Mỗi câu một ý, khoảng 8–20 chữ.
   Không dùng「！」, không cảm thán: giọng càng bình thản, con số càng thấy khủng.
6. **So với mốc quen thuộc**, không đưa số trơ trọi: ga tàu ngầm sâu nhất (42,3 m), tháp Skytree, tốc độ âm thanh, Tokyo–Osaka…
7. **Mỗi 30–60 giây có một bất ngờ vật lý** (twist): điều người xem không đoán trước, kèm giải thích một câu.
8. **Chi tiết đời thường nhỏ, hài nhẹ mà không pha trò**, ví dụ uống nước bằng ống hút khi đang lơ lửng, ngáp một cái.
   Gag của app (ngã sấp, ドーン!!) dùng tối đa 1–2 lần mỗi video.
9. **Kết bằng một câu trả lời + một vòng lặp.** Ví dụ: 「〜は38分の距離でした。」 hoặc "buông tay ra là lại rơi về".
   **Không** chèn thẻ Intro kênh, không xin like / đăng ký / bình luận trong lời đọc.
10. **Tiêu đề là câu hỏi có đơn vị đo**: 「〜たら、〜まで何分？」「〜は何日？」. Không bắt buộc mở bằng もしも.
11. **Mô tả có 3 phần**: `▼ もくじ` (app tự làm từ ô "Chương"), `▼ ことわり` (điều gì là giả định / 演出), `▼ 計算に使った値と出典` (nguồn cụ thể, có năm).
12. **Nhịp**: 6–8 phút. Mỗi câu khoảng 2–3 giây, đổi hình mỗi 3–5 giây, chương đặt tên bằng danh từ ngắn (家の前 / 地殻 / マントル…).

## Ví dụ: viết lại 5 beat đầu của tập mẫu (thang máy xuống tâm Trái Đất)

| Beat | Trước | Sau |
| --- | --- | --- |
| 1 | もしも家の前に、地球の中心まで行けるエレベーターができたら。乗ってみると、どんな旅になるのでしょうか。 | 朝の8時。家の前です。ドアの向こうは、地球の中心まで下りるエレベーターです。 |
| 2 | 乗るのは、世界最速クラスのエレベーター。時速およそ75キロで、まっすぐ下へ進みます。 | 中心までは6371km。速さは時速75km。何日かかるのか、乗って確かめます。 |
| 3 | 地下はとても熱くなるので、今回は熱にも圧力にも耐える、特別なスーツを着ていきます。 | 地下は熱く、重くなります。なので、熱にも圧力にも負けないスーツを着ます。 |
| 4 | それでは、出発です！ | 8時ちょうど。出発です。 |
| 5 | 出発から24分。深さ30キロで、地面の岩の層「地殻」を抜けます。周りの温度は、もう500℃を超えています。 | 8時24分。深さ30km。地殻を抜けました。外の岩は、もう500℃です。 |

## Trường JSON mới

```json
{
  "readings": { "地殻": "ちかく", "外核": "がいかく" },
  "beats": [
    { "id": "beat_01", "chapter": "家の前", "ja_narration": "朝の8時。家の前です。" }
  ]
}
```

- `readings`: cách đọc cho giọng đọc. Phụ đề vẫn giữ chữ Hán.
- `chapter`: tên chương bắt đầu từ beat đó. Cần ít nhất 3 chương, mỗi chương ≥ 10 giây, thì app mới tự làm `▼ もくじ`.

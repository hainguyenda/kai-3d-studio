import type { Episode } from "./types";

/*
  Tập mẫu: もしも家の前に、地球の中心まで行けるエレベーターができたら
  Tốc độ thang máy 75 km/h (thang nhanh nhất thế giới ~ 20–21 m/s).
  Mốc thời gian (xuất phát 12:00:00): 30 km → 24 phút; 2.900 km → 38 giờ 40 phút;
  5.150 km → 68 giờ 40 phút; 6.371 km (tâm) → 84 giờ 57 phút ≈ 3 ngày rưỡi.
  progress = độ sâu / đường kính Trái Đất (12.742 km): tâm = 0.5.
*/
export const DEMO_EPISODE: Episode = {
  title: "もしも家の前に、地球の中心まで行けるエレベーターができたら",
  title_vi: "Nếu trước nhà có thang máy đi xuống tâm Trái Đất",
  thumbnailText: "地球の中心まで 何日かかる？",
  beats: [
    {
      id: "beat_01", scene: "japanese_street", cameraPreset: "front_medium", characterAction: "idle_wave",
      vi_note: "Nếu trước nhà có một chiếc thang máy đi thẳng xuống tâm Trái Đất. Thử đi một chuyến thì sẽ thế nào?",
      ja_narration: "もしも家の前に、地球の中心まで行けるエレベーターができたら。乗ってみると、どんな旅になるのでしょうか。",
      caption: "地球の中心へ",
      hudStart: { time: "12:00:00", depthKm: 0, speedKmh: 0, progress: 0 }, hudEnd: { time: "12:00:06", depthKm: 0, speedKmh: 0, progress: 0 },
    },
    {
      id: "beat_02", scene: "japanese_street", cameraPreset: "hole_topdown", characterAction: "look_down",
      vi_note: "Đây là loại thang máy nhanh nhất thế giới, chạy thẳng xuống với tốc độ khoảng 75 km/h.",
      ja_narration: "乗るのは、世界最速クラスのエレベーター。時速およそ75キロで、まっすぐ下へ進みます。",
      hudStart: { time: "12:00:06", depthKm: 0, speedKmh: 0, progress: 0 }, hudEnd: { time: "12:00:12", depthKm: 0, speedKmh: 0, progress: 0 },
    },
    {
      id: "beat_03", scene: "japanese_street", cameraPreset: "front_close", characterAction: "idle", spacesuit: true,
      vi_note: "Dưới lòng đất rất nóng, nên lần này nhân vật mặc bộ đồ đặc biệt chịu được cả nhiệt độ lẫn áp suất.",
      ja_narration: "地下はとても熱くなるので、今回は熱にも圧力にも耐える、特別なスーツを着ていきます。",
      hudStart: { time: "12:00:12", depthKm: 0, speedKmh: 0, progress: 0 }, hudEnd: { time: "12:00:18", depthKm: 0, speedKmh: 0, progress: 0 },
    },
    {
      id: "beat_04", scene: "japanese_street", cameraPreset: "side_low", characterAction: "jump_in", spacesuit: true,
      vi_note: "Nào, xuất phát thôi!",
      ja_narration: "それでは、出発です！",
      hudStart: { time: "12:00:18", depthKm: 0, speedKmh: 0, progress: 0 }, hudEnd: { time: "12:00:20", depthKm: 0, speedKmh: 0, progress: 0 },
    },
    {
      id: "beat_05", scene: "underground_tunnel", cameraPreset: "tunnel_follow", characterAction: "idle", spacesuit: true, platform: true,
      vi_note: "24 phút sau khi xuất phát, ở độ sâu 30 km, ta ra khỏi lớp đá ngoài cùng gọi là vỏ Trái Đất. Nhiệt độ xung quanh đã vượt 500 độ C.",
      ja_narration: "出発から24分。深さ30キロで、地面の岩の層「地殻」を抜けます。周りの温度は、もう500℃を超えています。",
      hudStart: { time: "12:00:20", depthKm: 0, speedKmh: 75, progress: 0 }, hudEnd: { time: "12:24:00", depthKm: 30, speedKmh: 75, progress: 0.0024 },
    },
    {
      id: "beat_06", scene: "underground_tunnel", cameraPreset: "tunnel_top", characterAction: "idle", spacesuit: true, platform: true,
      vi_note: "Tiếp theo là lớp manti: đá nóng chảy chuyển động rất chậm, kéo dài tới độ sâu 2.900 km. Chỉ đi xuyên qua lớp này cũng mất hơn một ngày rưỡi.",
      ja_narration: "ここから先はマントル。熱い岩石がとてもゆっくり流れている層で、深さ2900キロまで続きます。通り抜けるだけで、1日半以上かかります。",
      hudStart: { time: "12:24:00", depthKm: 30, speedKmh: 75, progress: 0.0024 }, hudEnd: { time: "2 02:40:00", depthKm: 2900, speedKmh: 75, progress: 0.2276 },
    },
    {
      id: "beat_07", scene: "underground_tunnel", cameraPreset: "tunnel_follow", characterAction: "idle", spacesuit: true, platform: true,
      vi_note: "Từ độ sâu 2.900 km là lõi ngoài: một biển kim loại lỏng gồm sắt và niken nóng chảy, nhiệt độ trên 4.000 độ C.",
      ja_narration: "深さ2900キロからは外核。鉄やニッケルがドロドロに溶けた、液体の金属の海です。温度は4000℃を超えます。",
      hudStart: { time: "2 02:40:00", depthKm: 2900, speedKmh: 75, progress: 0.2276 }, hudEnd: { time: "3 08:40:00", depthKm: 5150, speedKmh: 75, progress: 0.4042 },
    },
    {
      id: "beat_08", scene: "underground_tunnel", cameraPreset: "core_orbit", characterAction: "idle", spacesuit: true, platform: true,
      vi_note: "Từ 5.150 km là lõi trong, nóng khoảng 5.500 độ C. Nhưng vì áp suất quá lớn nên sắt ở đây vẫn ở thể rắn.",
      ja_narration: "深さ5150キロからは内核。温度は約5500℃。それでも、ものすごい圧力のせいで、鉄は固体のままです。",
      hudStart: { time: "3 08:40:00", depthKm: 5150, speedKmh: 75, progress: 0.4042 }, hudEnd: { time: "4 00:56:48", depthKm: 6371, speedKmh: 0, progress: 0.5 },
    },
    {
      id: "beat_09", scene: "underground_tunnel", cameraPreset: "core_orbit", characterAction: "freefall_float", spacesuit: true,
      vi_note: "Cuối cùng cũng tới tâm Trái Đất. Ở đây bị kéo đều từ mọi hướng nên trọng lực gần như bằng 0, người nhẹ bẫng lơ lửng.",
      ja_narration: "そしてついに、地球の中心に到着。ここでは周りのすべての方向から同じ強さで引っぱられるので、重力はほぼゼロ。体がふわりと浮かびます。",
      hudStart: { time: "4 00:56:48", depthKm: 6371, speedKmh: 0, progress: 0.5 }, hudEnd: { time: "4 00:57:10", depthKm: 6371, speedKmh: 0, progress: 0.5 },
    },
    {
      id: "beat_10", scene: "underground_tunnel", cameraPreset: "core_orbit", characterAction: "flip_upside_down", spacesuit: true,
      vi_note: "Áp suất ở đây khoảng 3,6 triệu atm. Nếu đi tiếp từ đây, bạn sẽ bắt đầu đi \"lên\" về phía bên kia Trái Đất.",
      ja_narration: "気圧はおよそ360万気圧。ここから先へ進むと、今度は反対側に向かって「上る」ことになります。",
      hudStart: { time: "4 00:57:10", depthKm: 6371, speedKmh: 0, progress: 0.5 }, hudEnd: { time: "4 00:57:30", depthKm: 6371, speedKmh: 0, progress: 0.5 },
    },
    {
      id: "beat_11", scene: "earth_globe", cameraPreset: "globe_close", characterAction: "idle",
      vi_note: "Rời nhà khoảng ba ngày rưỡi. Tâm Trái Đất hoá ra xa hơn ta nghĩ rất nhiều.",
      ja_narration: "家を出てから、およそ3日半。地球の中心は、思っていたよりずっと遠い場所でした。",
      hudStart: { time: "4 00:57:30", depthKm: 6371, speedKmh: 0, progress: 0.5 }, hudEnd: { time: "4 00:57:40", depthKm: 6371, speedKmh: 0, progress: 0.5 },
    },
    {
      id: "beat_12", scene: "earth_globe", cameraPreset: "globe_wide", characterAction: "idle",
      vi_note: "Nếu là bạn, bạn sẽ mang theo gì cho chuyến đi này? Hãy bình luận cho mình biết nhé.",
      ja_narration: "あなたなら、この旅に何を持っていきますか？ぜひコメントで教えてください。",
      hudStart: { time: "4 00:57:40", depthKm: 6371, speedKmh: 0, progress: 0.5 }, hudEnd: { time: "4 00:57:50", depthKm: 6371, speedKmh: 0, progress: 0.5 },
    },
  ],
  youtube: {
    titles: [
      "もしも家の前に、地球の中心まで行けるエレベーターができたら",
      "地球の中心までエレベーターで何日かかる？【物理で計算】",
      "時速75キロで地球の中心へ…3日半の地底旅行",
    ],
    description: "家の前に地球の中心まで続くエレベーターがあったら、何日で着くのか。地殻・マントル・外核・内核を通り抜ける旅を、実際の数値で計算してみました。\n\n※数値は仮定に基づく概算です。",
    tags: ["もしも", "思考実験", "地球の中心", "地球の内部", "マントル", "物理", "科学", "3Dアニメ"],
  },
};

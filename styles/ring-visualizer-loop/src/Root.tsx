import React from 'react';
import { Composition, staticFile } from 'remotion';
import { getAudioDurationInSeconds } from '@remotion/media-utils';
import { RingVisualizer, RingVisualizerProps } from './RingVisualizer';

const FPS = 30;
const AUDIO_SRC = 'audio.wav'; // public/audio.wav（フル尺）
const SHORT_AUDIO_SRC = 'short.wav'; // public/short.wav（縦動画用の切り抜き＝ドロップ前後をffmpegで切り出す）

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* 16:9 フル尺（YouTube 本編用） */}
      <Composition
        id="RingVisualizer"
        component={RingVisualizer}
        fps={FPS}
        width={1920}
        height={1080}
        // 尺は音源の長さから自動算出 → 動画長が必ず曲に一致する
        durationInFrames={300}
        calculateMetadata={async () => {
          const dur = await getAudioDurationInSeconds(staticFile(AUDIO_SRC));
          return { durationInFrames: Math.ceil(dur * FPS) };
        }}
        defaultProps={
          {
            // ===== ここを編集して調整（横長フル尺） =====
            centerX: 0.5, // リング中心(画面比)
            centerY: 0.5, // コアが顔に被らないよう胸/首あたりへ。ループ素材がズームする瞬間も顔を外す（~0.50）
            imgShiftX: 0, // 背景は16:9のまま全体が収まるので移動不要
            imgShiftY: 0,
            intensity: 1.7, // 波形振幅の倍率（1.0=穏やか / 1.7=激しい）
            squirm: 26, // 進行波うねりの強さ(px)（14=普通 / 26=激しい）
            // objectPosY: 0.5, // 背景動画の縦位置(0=上/0.5=中央/1=下)。顔を切らない用
          } satisfies RingVisualizerProps
        }
      />

      {/* 9:16 縦動画（YouTube Shorts / TikTok 用・切り抜き） */}
      {/* public/short.wav（ドロップ前後の切り抜き）を使う。尺はその長さから自動算出。 */}
      <Composition
        id="RingVisualizerVertical"
        component={RingVisualizer}
        fps={FPS}
        width={1080}
        height={1920}
        durationInFrames={300}
        calculateMetadata={async () => {
          const dur = await getAudioDurationInSeconds(staticFile(SHORT_AUDIO_SRC));
          return { durationInFrames: Math.ceil(dur * FPS) };
        }}
        defaultProps={
          {
            // ===== ここを編集して調整（縦動画ショート） =====
            audioSrc: SHORT_AUDIO_SRC, // 切り抜き音源
            credits: [], // ショートのクレジットは任意（本編は必須）。出したいならこの行を削除＝既定3枚が入る
            centerX: 0.5, // 画面中央
            centerY: 0.55, // 中央の円(コア)が顔に被らないよう胸あたりへ（顔が主役）。still-checkで微調整
            imgShiftX: 0, // 横は中央
            imgShiftY: 0, // 16:9→9:16はcoverで全身が入る。寄せると過ズームで顔が切れるので基本0
            intensity: 1.7,
            squirm: 26,
            ringScale: 1.4, // 波形を大きく：横幅1080から大きくはみ出す迫力サイズ
            widthScale: 1.7, // 線を太くしてインパクトを出す（ショート向け）
            fadeInSec: 0.3, // さっと表示
            fadeOutSec: 0, // 末尾フェードなし＝盛り上がったまま「バスッと」終わる
            // objectPosY: 0.5, // 背景動画の縦位置。顔が切れる場合に調整
          } satisfies RingVisualizerProps
        }
      />
    </>
  );
};

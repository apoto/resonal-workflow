import React from 'react';
import { Img, staticFile } from 'remotion';

/**
 * BounceRig — 1枚のキャラPNGを拍に乗せて跳ねさせるリグ（squash & stretch）。CSS transform だけ＝レンダーはほぼ無料。
 *
 *  1) 部位（前髪/頭/胴体/腕/後ろ髪）は1枚のPNGを clip-path で切り分ける（個別生成すると位置合わせがズレる）。
 *     継ぎ目は数%重ねる＝割れない。
 *  2) 髪の回転中心は生え際。
 *  3) 全体の回転中心は体の一番下（接地点）。バストアップは squashOriginY で腰へ移す。
 *  4) 本体＝拍に合わせて縦横比を動かす。沈み X:100→102% / Y:100→92%  戻し X:103→100% / Y:95→100%
 *  5) 上げと下げでイージングを変える（上げ=強い ease-out / 下げ=強い ease-in）。
 *
 * 部位ごとに 1〜3フレームの位相遅延を入れて、接地→胴→頭→髪の順に跳ねを伝播させる。
 */

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
// 上げ＝強い ease-out（一気に出て減速）／下げ＝強い ease-in（ためてから加速）。1つの動きの中で合成する。
const easeOut3 = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);
const easeIn3 = (t: number) => Math.pow(clamp01(t), 3);
const easeOut2 = (t: number) => 1 - Math.pow(1 - clamp01(t), 2);
const easeIn2 = (t: number) => Math.pow(clamp01(t), 2);

export type BounceState = {
  sx: number;   // 横の拡大率
  sy: number;   // 縦の拡大率
  dy: number;   // 上下移動(px)
  sq: number;   // 潰れ量 0..1（髪の広がりに使う）
};

/**
 * 1拍ぶんの跳ね。u = 拍内位相 0..1。
 * 着地に向かって予備動作で潰れていく＝ u=0 と u=1 の値が一致し、拍をまたいでも連続（1フレームの段差を作らない）。
 * カーブは非対称にする。対称（smoothstep）にすると緩急比（1フレームの変化量 最大/平均）が 2.2倍まで落ちてのっぺりする。
 * この形で約 4.1倍。「1フレームあたりの変化量を小さくする」方向で直すと緩急まで消える。
 */
function beatBounce(u: number, amp: number): { sx: number; sy: number; dy: number; sq: number } {
  const REC = 0.30;              // 着地→跳び出し（ease-out＝一気に出て減速）
  const AIR = 0.34;              // 頂点の滞空
  const ANT = 1 - REC - AIR;     // 落下→次の着地（ease-in＝ためてから加速）
  let sq: number;   // 潰れ 0..1
  let arc: number;  // 高さ 0..1
  if (u < REC) {
    // 上げ: 潰れが**一気に**抜けて跳び出す。減速しながら頂点へ
    sq = 1 - easeOut3(u / REC);
    arc = easeOut2(u / REC);
  } else if (u < REC + AIR) {
    // 頂点: ふわっと留まる（ここが「静」＝緩急の"緩"）
    sq = 0;
    arc = 1;
  } else {
    // 下げ: ゆっくり落ち始めて**加速**し、着地の直前に一気に潰れる（＝"急"）
    const k = (u - REC - AIR) / ANT;
    sq = easeIn3(k);
    arc = 1 - easeIn2(k);
  }
  return {
    sy: 1 - 0.078 * amp * sq + 0.0066 * amp * arc,
    sx: 1 + 0.028 * amp * sq - 0.004 * amp * arc,
    dy: -13 * amp * arc,
    sq: amp * sq,
  };
}

/**
 * 裏拍に小さな跳ね（振幅 0.25）を重ねる。0.4 だと表と同じくらい目立ち、1拍に2回跳ねてせわしなく見える。
 * @param phaseSec 曲の最初の拍がある絶対秒。0 のままだと跳ねが曲とズレる＝実測値を渡す（MV プロジェクトの tools/02_estimate_tempo.py）。
 *                 BPM も発注値ではなく実測値を渡す。
 */
export function bounceAt(frame: number, fps: number, bpm: number, gain = 1, phaseSec = 0): BounceState {
  const beat = (60 / bpm) * fps;          // 1拍のフレーム数
  const f = frame - phaseSec * fps;
  const u = ((((f % beat) + beat) % beat) / beat);
  const main = beatBounce(u, gain);
  const sub = beatBounce((u + 1 / 3) % 1, gain * 0.25);
  return {
    sx: main.sx * sub.sx,
    sy: main.sy * sub.sy,
    dy: main.dy + sub.dy,
    sq: Math.max(main.sq, sub.sq),
  };
}

type PartProps = {
  img: string;
  aspect: number;      // 画像の 幅/高
  clip: string;        // clip-path の polygon()
  ox: number;          // 回転中心 x(%)
  oy: number;          // 回転中心 y(%)
  rot: number;         // 回転(度)
  z: number;
};

const Part: React.FC<PartProps> = ({ img, clip, ox, oy, rot, z }) => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      zIndex: z,
      clipPath: clip,
      transform: `rotate(${rot}deg)`,
      transformOrigin: `${ox}% ${oy}%`,
      willChange: 'transform',
    }}
  >
    <Img src={staticFile(img)} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
  </div>
);

/**
 * キャリブレーション（キャラを差し替えたら必ずやる）
 *   ffmpeg -y -i public/char_full.png -vf "drawgrid=w=iw/10:h=ih/10:t=2:c=red@0.8" out/char_grid.png
 *   でグリッドを重ね、首/腰/生え際の位置を読んで下の CLIP と ox,oy を書き換える。
 *   隣り合うクリップは**継ぎ目で数%重ねる**（これが割れ防止の本体）。
 */
const CLIP = {
  // サンプル値（あるキャラの実測）。キャラを差し替えたらグリッドで読み直す。
  //   読む位置: 生え際 / 顎 / 首の硬いエッジ（チョーカー・襟など）/ 肩 / 腰 / 裾 / 膝 / 接地
  // 頭＋前髪。境界は元絵の硬いエッジの上（ここでは首元の線 19%）に置く。
  //   肩の高さで切ると、頭と胴の回転差が袖の上に段差の線として出る。
  head: 'polygon(0% 0%, 100% 0%, 100% 19%, 0% 19%)',
  // 胴体＋腕（上を頭と 15–19% で重ね、下を脚と 48–52% で重ねる）
  torso: 'polygon(0% 15%, 100% 15%, 100% 52%, 0% 52%)',
  // 脚＋ブーツ（接地。回さない）
  legs: 'polygon(0% 48%, 100% 48%, 100% 100%, 0% 100%)',
  // 後ろ髪の左右。腕（このサンプルでは x 27–75%）を噛まないよう帯を細くする＝噛むと腕が一緒にせん断される
  hairL: 'polygon(0% 6%, 27% 6%, 27% 70%, 0% 70%)',
  hairR: 'polygon(73% 6%, 100% 6%, 100% 70%, 73% 70%)',
};

export const BounceRig: React.FC<{
  img: string;
  aspect: number;
  frame: number;
  fps: number;
  bpm: number;
  gain?: number;         // 跳ねの強さ（静の区間は 0.35、サビは 1.0 など）
  /**
   * 潰れの回転中心（キャラ画像内の y%）。既定 100＝足元＝接地点（全身カット用）。
   * バストアップでは画面下端に来るライン（腰）を指定する。足元を軸に潰すと頭の上下動が大きくなりすぎて枠から飛び出す。
   */
  squashOriginY?: number;
  /** 跳ねの量を一括で下げる係数（形は変えず量だけ落とす）。バストアップは 0.54 前後。 */
  amountScale?: number;
  /**
   * 跳ねを止めた区間で、拍に同期しないゆっくりした呼吸（4秒周期・±0.4%）だけ残す。
   * 完全静止フレームを作らないため。
   */
  idleBreath?: boolean;
  /** 曲の最初の拍がある絶対秒（実測値）。 */
  phaseSec?: number;
  heightPct?: number;    // 画面高に対するキャラの高さ(%)
  x?: number;            // 画面幅に対する中心 x(%)
  bottom?: number;       // 画面高に対する接地点 y(%)
  filter?: string;
}> = ({ img, aspect, frame, fps, bpm, gain = 1, heightPct = 78, x = 34, bottom = 96, filter, squashOriginY = 100, amountScale = 1, idleBreath = false, phaseSec = 0 }) => {
  const raw = bounceAt(frame, fps, bpm, gain * amountScale, phaseSec);
  // 揺れない区間: 拍から切り離した呼吸だけ（4秒周期・±0.4%）
  const br = idleBreath ? Math.sin((2 * Math.PI * frame) / (fps * 4)) : 0;
  const b = idleBreath
    ? { sx: 1 - 0.002 * br, sy: 1 + 0.004 * br, dy: -1.2 * br, sq: 0 }
    : raw;
  // 位相遅延: 接地(0) → 胴(1F) → 頭(2F) → 髪(3F)。跳ねが下から上へ伝播する。
  const bHair = bounceAt(frame - 3, fps, bpm, gain * amountScale, phaseSec);

  /**
   * 頭・胴は左右に振らない（跳ねと無関係な独立運動は「首だけ回っている」ように見えて不気味）。
   * 残すのは跳ねに従属する動きだけ: 上下の位相遅延と、潰れ量に応じた髪の広がり。
   */
  const hairSplay = 2.8 * bHair.sq;

  const h = heightPct;
  const w = h * aspect;

  // 接地影。跳ねと連動させる＝浮くと小さく薄く、着地で広く濃く。無いと「貼ってある」ように見える。
  const lift = -b.dy;                       // 0（着地）〜10px前後（最高点）
  const shW = w * (1.02 - lift * 0.012);
  const shOp = 0.55 * (1 - lift * 0.035);

  return (
    <div
      style={{
        position: 'absolute',
        left: `${x}%`,
        bottom: `${100 - bottom}%`,
        width: `${w}vh`,
        height: `${h}vh`,
        marginLeft: `${-w / 2}vh`,
      }}
    >
      {/* 接地影（跳ねのスケールの外側に置く＝影まで潰れると接地感が壊れる） */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          bottom: `${-h * 0.012}vh`,
          width: `${shW * 0.62}vh`,
          height: `${h * 0.045}vh`,
          marginLeft: `${-shW * 0.31}vh`,
          borderRadius: '50%',
          background: `radial-gradient(50% 50% at 50% 50%, rgba(0,0,0,${shOp}) 0%, rgba(0,0,0,0) 72%)`,
          filter: 'blur(3px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          // 潰れの回転中心＝接地点（全身）か腰（バストアップ）
          transformOrigin: `50% ${squashOriginY}%`,
          transform: `translateY(${b.dy}px) scale(${b.sx}, ${b.sy})`,
          filter,
          willChange: 'transform',
        }}
      >
        <div style={{ position: 'absolute', inset: 0 }}>
          {/* 後ろ髪は体の背面＝先に描く。生え際(y≈8%)を軸に、着地の潰れに応じて外へ広がる */}
          <Part img={img} aspect={aspect} clip={CLIP.hairL} ox={26} oy={8} rot={-hairSplay} z={1} />
          <Part img={img} aspect={aspect} clip={CLIP.hairR} ox={74} oy={8} rot={hairSplay} z={1} />
          {/* 脚＝接地。回さない */}
          <Part img={img} aspect={aspect} clip={CLIP.legs} ox={50} oy={100} rot={0} z={2} />
          {/* 胴体。左右には振らない＝上下の跳ねだけ */}
          <Part img={img} aspect={aspect} clip={CLIP.torso} ox={50} oy={50} rot={0} z={3} />
          {/* 頭。左右には振らない。生きて見えるのは跳ねの位相遅延による */}
          <Part img={img} aspect={aspect} clip={CLIP.head} ox={50} oy={19} rot={0} z={4} />
        </div>
      </div>
    </div>
  );
};

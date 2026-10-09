import React from 'react';
import { AbsoluteFill, Audio, Img, Sequence, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { Figure, SceneSpec, Section } from './spec';
import { getField, getOverlay, getStageFx, getTreatment } from './registry';

/**
 * SceneSpec を Remotion の Sequence 木に展開する。
 * ここに演出は一切書かない — 演出は treatment / field / overlay 側にある。
 * このファイルが薄いままであることが、キットが正しく分離できている証拠。
 *
 * 1セクションの層順（下から）:
 *   field(behind) → 歌詞(behind) → figures → field(front) → 歌詞(front)
 *
 * field(front) は近景を**被写体の手前**に出すための層。
 * 被写体を全部前に置くと都市の上に浮いた巨人に見える（実測で2回そうなった）。
 */

const Missing: React.FC<{ what: string }> = ({ what }) => (
  <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
    <div style={{ color: '#ff3b57', font: '700 42px monospace', textAlign: 'center' }}>?? {what}</div>
  </AbsoluteFill>
);

/** Sequence 内のローカルフレーム（0 = そのクリップの開始）を子に渡すだけの小物 */
const LocalFrame: React.FC<{ children: (local: number) => React.ReactNode }> = ({ children }) => (
  <>{children(useCurrentFrame())}</>
);

const LineLayer: React.FC<{
  section: Section;
  index: number;
  scale: number;
  offset: number;
  palette: Record<string, string>;
  layer?: 'behind' | 'front';
  lyricY?: number;
}> = ({ section, index, scale, offset, palette, layer, lyricY }) => {
  const { fps } = useVideoConfig();
  const line = section.lines[index];
  const t = getTreatment(section.treatment);
  if (!t) return <Missing what={`treatment ${section.treatment}`} />;
  const C = t.component;
  const from = Math.round((line.t + offset) * fps);
  const dur = Math.max(1, Math.round(line.hold * fps));
  const params = { ...(section.params ?? {}), ...(line.params ?? {}), ...(lyricY !== undefined ? { y: lyricY } : {}) };
  return (
    <Sequence from={from} durationInFrames={dur} layout="none">
      <LocalFrame>
        {(local) => (
          <C
            line={line}
            lines={[line]}
            index={index}
            local={local}
            sectionFrom={section.from}
            params={params}
            scale={scale}
            palette={palette}
            layer={layer}
          />
        )}
      </LocalFrame>
    </Sequence>
  );
};

/** scope='section' の treatment。セクション全体に1インスタンス張る。 */
const SectionLayer: React.FC<{
  section: Section;
  scale: number;
  offset: number;
  dropWideOnly: boolean;
  palette: Record<string, string>;
  layer?: 'behind' | 'front';
}> = ({ section, scale, offset, dropWideOnly, palette, layer }) => {
  const { fps } = useVideoConfig();
  const t = getTreatment(section.treatment);
  if (!t) return <Missing what={`treatment ${section.treatment}`} />;
  const C = t.component;
  const lines = dropWideOnly ? section.lines.filter((l) => !l.params?.wideOnly) : section.lines;
  if (lines.length === 0) return null;
  const from = Math.round((section.from + offset) * fps);
  const dur = Math.max(1, Math.round((section.to - section.from) * fps));
  return (
    <Sequence from={from} durationInFrames={dur} layout="none">
      <LocalFrame>
        {(local) => (
          <C
            lines={lines}
            index={0}
            local={local}
            sectionFrom={section.from}
            params={section.params ?? {}}
            scale={scale}
            palette={palette}
            layer={layer}
          />
        )}
      </LocalFrame>
    </Sequence>
  );
};

const OverlayLayer: React.FC<{
  id: string;
  t: number;
  hold: number;
  params?: Record<string, unknown>;
  scale: number;
  offset: number;
  palette: Record<string, string>;
}> = ({ id, t, hold, params, scale, offset, palette }) => {
  const { fps } = useVideoConfig();
  const def = getOverlay(id);
  if (!def) return <Missing what={`overlay ${id}`} />;
  const C = def.component;
  const dur = Math.max(1, Math.round(hold * fps));
  return (
    <Sequence from={Math.round((t + offset) * fps)} durationInFrames={dur} layout="none">
      <LocalFrame>
        {(local) => (
          <C local={local} durationInFrames={dur} params={params ?? {}} scale={scale} palette={palette} />
        )}
      </LocalFrame>
    </Sequence>
  );
};

/** セクションの面。layer='front' のとき被写体より手前に出る。 */
const FieldLayer: React.FC<{
  section: Section;
  scale: number;
  offset: number;
  palette: Record<string, string>;
  layer: 'behind' | 'front';
}> = ({ section, scale, offset, palette, layer }) => {
  const { fps } = useVideoConfig();
  const id = section.stage?.field;
  if (!id) return null;
  const def = getField(id);
  if (!def) return <Missing what={`field ${id}`} />;
  if (!def.layered && layer === 'front') return null;
  const C = def.component;
  const from = Math.round((section.from + offset) * fps);
  const dur = Math.max(1, Math.round((section.to - section.from) * fps));
  return (
    <Sequence from={from} durationInFrames={dur} layout="none">
      <LocalFrame>
        {(local) => (
          <C
            local={local}
            durationInFrames={dur}
            sectionFrom={section.from}
            params={section.stage?.fieldParams ?? {}}
            scale={scale}
            palette={palette}
            layer={layer}
          />
        )}
      </LocalFrame>
    </Sequence>
  );
};

/**
 * 被写体プレート（静止画）。
 * ★プレートの被写体が左右下で切れている素材が多い。小さく置くと切れ目が画面内に出るので、
 *   **プレート幅＝画面幅**（scale 1.0）で置いて切れ目を枠外へ逃がす。
 */
/**
 * 被写体プレートの src を決める。`seq` があれば**透過連番PNG**の該当コマを返す
 * （`<dir>/001.png` からの連番）。
 * 素材の fps は 動画生成サービスの 24 等でコンポジションと違うので、秒から引き直す。
 */
const figureSrc = (f: Figure, local: number, fps: number): string => {
  if (f.seq && f.seq.len > 0) {
    const sfps = f.seq.fps ?? fps;
    const idx = Math.floor(((local / fps) * sfps) % f.seq.len);
    return `${f.seq.dir}/${String(idx + 1).padStart(3, '0')}.png`;
  }
  return f.src ?? '';
};

const FigureLayer: React.FC<{ section: Section; scale: number; offset: number }> = ({
  section,
  scale,
  offset,
}) => {
  const { fps, width } = useVideoConfig();
  const figures = section.stage?.figures;
  if (!figures || figures.length === 0) return null;
  const from = Math.round((section.from + offset) * fps);
  const dur = Math.max(1, Math.round((section.to - section.from) * fps));
  return (
    <Sequence from={from} durationInFrames={dur} layout="none">
      <LocalFrame>
        {(local) => (
      <AbsoluteFill style={{ overflow: 'hidden', pointerEvents: 'none' }}>
        {figures.map((f: Figure, i) => (
          <Img
            key={i}
            src={staticFile(figureSrc(f, local, fps))}
            style={{
              position: 'absolute',
              width: width * (f.scale ?? 1) * scale,
              left: `${f.x ?? 50}%`,
              top: `${f.y ?? 50}%`,
              transform: `translate(-50%, -50%)${f.flip ? ' scaleX(-1)' : ''}`,
            }}
          />
        ))}
      </AbsoluteFill>
        )}
      </LocalFrame>
    </Sequence>
  );
};

export const Scene: React.FC<{
  spec: SceneSpec;
  /** 歌詞より後ろに来る層（空・遠景・装飾）。section.stage.field で足りるなら不要 */
  background?: React.ReactNode;
  /**
   * 歌詞より前に来る層（キャラ・前景の泡やリボン等）。
   * burn-in は歌詞が**キャラの背面**にあり、これが無いと文字が顔の上に乗って字幕になる。
   * section.stage.figures を使う場合はこちらは不要。
   */
  foreground?: React.ReactNode;
  /** 9:16 等での縮小率 */
  scale?: number;
  /**
   * 被写体プレートだけに掛ける倍率（省略時は scale と同じ）。
   */
  figureScale?: number;
  /**
   * 歌詞の縦位置(%)を**丸ごと上書き**する（省略時はセクション/行の y をそのまま使う）。
   */
  lyricY?: number;
  /** 区間切り出し（ショート用）。指定するとこの秒数ぶん時間をずらす */
  startSec?: number;
  /** wideOnly な行を落とす（ショート用） */
  dropWideOnly?: boolean;
  /**
   * false にすると**歌詞を一切描かない**。
   */
  lyrics?: boolean;
  /** 音声を鳴らすか */
  audio?: boolean;
  children?: React.ReactNode;
}> = ({ spec, background, foreground, scale = 1, figureScale, lyricY, startSec = 0, dropWideOnly = false, audio = true, lyrics = true, children }) => {
  const { fps } = useVideoConfig();
  const offset = (spec.meta.timingOffsetSec ?? 0) - startSec;
  const palette = spec.stage.palette ?? {};
  // stage fx は children を包む＝入れ子で積む（overlay の加算とは別レイヤー概念）
  const wrapFx = (node: React.ReactNode) =>
    (spec.stage.fx ?? []).reduceRight((acc, f) => {
      const def = getStageFx(f.id);
      if (!def) return acc;
      const C = def.component;
      return (
        <C from={f.from + offset} to={f.to + offset} params={f.params ?? {}} scale={scale}>
          {acc}
        </C>
      );
    }, node);

  // ★stage.fx の外に出すセクション（暗転後のカード等）。ここに挙げた id は fx に包まれない。
  const afterFx = new Set(spec.stage.afterFx ?? []);

  /** 歌詞層。layered な treatment は背面/手前の2回呼ばれ、層に属する要素だけを描く。 */
  const lyricLayer = (layer: 'behind' | 'front') => (
    <>
      {spec.sections.map((section) => {
        if (afterFx.has(section.id)) return null;   // fx の外で別に描く
        const t = getTreatment(section.treatment);
        if (!t) return null;
        // layered でない treatment は、宣言した層のパスでだけ描く（既定は背面）
        if (!t.layered && layer !== (t.layer ?? 'behind')) return null;
        return (
          <React.Fragment key={`${section.id}-${layer}`}>
            {t.scope === 'section' ? (
              <SectionLayer
                section={section}
                scale={scale}
                offset={offset}
                dropWideOnly={dropWideOnly}
                palette={palette}
                layer={layer}
              />
            ) : (
              section.lines.map((line, i) =>
                dropWideOnly && line.params?.wideOnly ? null : (
                  <LineLayer
                    key={`${section.id}-${i}`}
                    section={section}
                    index={i}
                    scale={scale}
                    offset={offset}
                    palette={palette}
                    layer={layer}
                    lyricY={lyricY}
                  />
                )
              )
            )}
          </React.Fragment>
        );
      })}
    </>
  );

  /**
   * セクションのオーバーレイ（合いの手・FX・クレジット等）。
   */
  const sectionOverlays = (
    <>
      {spec.sections.map((section) =>
        (section.overlays ?? []).map((o, i) => (
          <OverlayLayer key={`${section.id}-o${i}`} {...o} scale={scale} offset={offset} palette={palette} />
        ))
      )}
    </>
  );

  const fieldLayer = (layer: 'behind' | 'front') => (
    <>
      {spec.sections.map((section) => (
        <FieldLayer
          key={`${section.id}-f-${layer}`}
          section={section}
          scale={scale}
          offset={offset}
          palette={palette}
          layer={layer}
        />
      ))}
    </>
  );

  return (
    <AbsoluteFill style={{ background: spec.stage.fill ?? '#000' }}>
      {wrapFx(
        <AbsoluteFill>
          {background}

          {/* セクションごとの面（一番下） */}
          {fieldLayer('behind')}

          {(spec.stage.ambient ?? []).map((o, i) => (
            <OverlayLayer key={`amb${i}`} {...o} scale={scale} offset={offset} palette={palette} />
          ))}

          {sectionOverlays}

          {lyrics && lyricLayer('behind')}

          {/* 歌詞（背面ぶん）より前に来る層＝キャラ・前景要素 */}
          {spec.sections.map((section) => (
            <FigureLayer key={`${section.id}-fig`} section={section} scale={figureScale ?? scale} offset={offset} />
          ))}
          {foreground}

          {/*
            被写体より前・歌詞より後ろの常時レイヤー。
            白飛びのように「被写体まで巻き込んで隠し、そのうえに歌詞だけ残す」ために必要な層。
          */}
          {(spec.stage.ambientFront ?? []).map((o, i) => (
            <OverlayLayer key={`ambf${i}`} {...o} scale={scale} offset={offset} palette={palette} />
          ))}

          {/* 近景の面を被写体の手前に。これが無いと被写体が背景の上に浮く */}
          {fieldLayer('front')}

          {/* 被写体の手前に出す歌詞。読ませたい語はここに出ないと右半分が隠れて読めない */}
          {lyrics && lyricLayer('front')}
        </AbsoluteFill>
      )}

      {children}

      {audio && (
        <Audio
          src={staticFile(spec.meta.audio)}
          startFrom={startSec ? Math.round(startSec * fps) : undefined}
        />
      )}
      {/* ★stage.fx の**外＝最前面**に置く層（CRT落ち等で潰れない）。
          fx より前に書くと fx の黒い面に覆われるので、必ず最後に描く。 */}
      {lyrics && afterFx.size > 0 && (
        <>
          {spec.sections.filter((sec) => afterFx.has(sec.id)).map((section) => {
            const t = getTreatment(section.treatment);
            if (!t) return null;
            return t.scope === 'section' ? (
              <SectionLayer key={`af-${section.id}`} section={section} scale={scale} offset={offset}
                dropWideOnly={dropWideOnly} palette={palette} layer="front" />
            ) : (
              <React.Fragment key={`af-${section.id}`}>
                {section.lines.map((line, i) => (
                  dropWideOnly && line.params?.wideOnly ? null : (
                    <LineLayer key={`af-${section.id}-${i}`} section={section} index={i}
                      scale={scale} offset={offset} palette={palette} layer={t.layer ?? 'behind'} />
                  )
                ))}
              </React.Fragment>
            );
          })}
        </>
      )}
    </AbsoluteFill>
  );
};

/** spec から必要な総フレーム数 */
export const sceneDuration = (spec: SceneSpec) => Math.round(spec.meta.duration * spec.meta.fps);

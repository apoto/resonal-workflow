import React from 'react';
import { Line } from './spec';

/**
 * treatment = 「1セクションぶんの歌詞の見せ方」。
 * 1行を描く React コンポーネント + そのメタデータ。
 *
 * direction-library の演出レコードと 1:1 で対応づける（record フィールド）。
 * 散文レコードと実装が別々に暮らしていたのが、カタログが使われなかった直接の原因なので、
 * **登録時に必ず record を書く**。書けない＝まだ演出として言語化できていない。
 */
export type TreatmentProps = {
  /** scope='line' のときその行。scope='section' では undefined */
  line?: Line;
  /**
   * scope='section' のときセクションの全行（scope='line' では [line]）。
   * 「歌詞が複数フレーズにまたがって画面に積もる」型はセクション全体を見ないと作れない
   * （参考にした MV のサビは約9秒ぶん積もってから1フレームで一掃される）。
   */
  lines: Line[];
  /** セクション内での行番号。scope='section' では 0 */
  index: number;
  /** ローカルフレーム。scope='line' は行頭が0 / scope='section' はセクション頭が0 */
  local: number;
  /** セクション開始秒（scope='section' で各行の相対時刻を出すのに使う） */
  sectionFrom: number;
  /** セクション既定 + 行 params をマージしたもの */
  params: Record<string, unknown>;
  /** 9:16 ショート等での縮小率。1 = 本編16:9 */
  scale: number;
  /** layered=true のとき、今描いている層 */
  layer?: 'behind' | 'front';
  /** 曲ごとの配色（spec.stage.palette）。キー名はスタイルパックが決める */
  palette: Record<string, string>;
};

export type Treatment = {
  id: string;
  /**
   * この treatment が**実際に解釈する** params のキー。
   *
   * 宣言は**任意**（未宣言の treatment は検査しない）＝既存スタイルを壊さずに移行できる。
   * spec 共通のキー（scale / y / wideOnly / allowOverlap 等）は lint 側が既知として除く。
   */
  paramKeys?: string[];
  /**
   * 'line'（既定）= 1行ごとに Sequence が切られる
   * 'section'     = セクションに1インスタンス。行の出入りは treatment 側で管理する
   */
  scope?: 'line' | 'section';
  /**
   * true にすると Scene がこの treatment を**被写体の前と後ろの2箇所**で描画し、
   * props.layer で 'behind' / 'front' を渡す。treatment 側はその層に属する要素だけ描く。
   * 全部背面に置くと被写体で隠れて読めず、全部手前だと字幕になるので、
   * 「特大の短い語＝背面(貫通)／読ませたい語＝手前」を1つの treatment で出し分けるため。
   */
  layered?: boolean;
  /**
   * layered=false のとき、被写体（section.stage.figures / Scene の foreground）の
   * **どちら側**に描くか。既定 'behind'。
   *
   * ★スタイルによって正解が逆になる。
   *   burn-in は歌詞がキャラの**背面** → 'behind'
   *   plate-swap は実測で 面 ＜ キャラ ＜ **文字（手前）** → 'front'
   *   ここを間違えると、不透過のプレートで文字が丸ごと消える（実際に消えた）。
   */
  layer?: 'behind' | 'front';
  /** スタイルパック id */
  style: string;
  name: string;
  /** 対応する direction-library のレコード slug（必須） */
  record: string;
  /** 向いているセクション種別 */
  fits: string[];
  /** 推奨文字数 */
  textLen: [number, number];
  description: string;
  component: React.FC<TreatmentProps>;
};

export type OverlayProps = {
  local: number;
  durationInFrames: number;
  params: Record<string, unknown>;
  scale: number;
  palette: Record<string, string>;
};

/**
 * Field = セクションの「面」（背景そのもの）。
 * overlay（上に足す）でも stageFx（包んで変形する）でもなく、**一番下に敷く**層。
 *
 * ★画像パスと色は params / palette で受け取り、**field の実装に焼き込まない**。
 *   焼き込むと曲ごとの差し替えでスタイルパックを編集することになり、
 *   他の曲まで巻き込む（そうやって死んだカタログがある）。
 */
export type FieldProps = {
  /** セクション頭を0とするローカルフレーム */
  local: number;
  durationInFrames: number;
  /**
   * セクション開始秒。**scene.ts は時刻を全部「絶対秒」で書く**ので、
   * 面の中で「この秒に切り替える」を書きたいときに相対へ直すために要る
   * （TreatmentProps が sectionFrom を持つのと同じ理由）。
   */
  sectionFrom: number;
  params: Record<string, unknown>;
  scale: number;
  palette: Record<string, string>;
  /** layered=true のとき、今描いている層。'front' は被写体の手前に出る */
  layer?: 'behind' | 'front';
};

export type FieldDef = {
  id: string;
  style: string;
  name: string;
  /** 対応する direction-library のレコード slug（必須） */
  record: string;
  /**
   * true にすると Scene がこの field を**被写体の前と後ろの2箇所**で描画する。
   * 近景のビルを被写体の手前に出して足元を隠す等（後ろに全部置くと被写体が浮く）。
   */
  layered?: boolean;
  description: string;
  component: React.FC<FieldProps>;
};

export type OverlayDef = {
  id: string;
  style: string;
  name: string;
  record?: string;
  description: string;
  component: React.FC<OverlayProps>;
};

export type StageFxProps = {
  /** 曲頭を0とする秒（区間切り出し時の offset 適用済み） */
  from: number;
  to: number;
  params: Record<string, unknown>;
  scale: number;
  children: React.ReactNode;
};

/** 画面全体を包んで変形する効果。overlay と違い children を取る。 */
export type StageFxDef = {
  id: string;
  style: string;
  name: string;
  record?: string;
  description: string;
  component: React.FC<StageFxProps>;
};

const treatments = new Map<string, Treatment>();
const fields = new Map<string, FieldDef>();
const stageFx = new Map<string, StageFxDef>();
const overlays = new Map<string, OverlayDef>();

export const registerTreatments = (...list: Treatment[]) => {
  list.forEach((t) => treatments.set(t.id, t));
};
export const registerOverlays = (...list: OverlayDef[]) => {
  list.forEach((o) => overlays.set(o.id, o));
};

export const registerStageFx = (...list: StageFxDef[]) => {
  list.forEach((f) => stageFx.set(f.id, f));
};
export const getStageFx = (id: string) => stageFx.get(id);
export const listStageFx = (style?: string) =>
  [...stageFx.values()].filter((f) => !style || f.style === style);

export const registerFields = (...list: FieldDef[]) => {
  list.forEach((f) => fields.set(f.id, f));
};
export const getField = (id: string) => fields.get(id);
export const listFields = (style?: string) =>
  [...fields.values()].filter((f) => !style || f.style === style);

export const getTreatment = (id: string) => treatments.get(id);
export const getOverlay = (id: string) => overlays.get(id);
export const listTreatments = (style?: string) =>
  [...treatments.values()].filter((t) => !style || t.style === style);
export const listOverlays = (style?: string) =>
  [...overlays.values()].filter((o) => !style || o.style === style);

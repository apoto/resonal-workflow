/** PhotocopyZineType が受け取る実行時の1行（Stage が t/hold から算出する） */
export interface RuntimeLyric {
  text: string;
  t: number;
  hold: number;
  startFrame: number;
  endFrame: number;
  scale?: number;
  accent?: string;
}

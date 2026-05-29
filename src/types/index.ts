export type PaintPoint = {x: number; y: number};

export type Stroke = {
  id: string;
  color: string;
  size: number;
  points: PaintPoint[];
};

export type TextStyleModel = {
  color: string;
  fontSize: number;
  fontWeight: 'normal' | 'bold';
  letterSpacing: number;
  lineHeight: number;
};

export type TextItem = {
  id: string;
  x: number;
  y: number;
  text: string;
  style: TextStyleModel;
};

export type PageData = {
  id: string;
  imagePath: string;
  width: number;
  height: number;
  strokes: Stroke[];
  texts: TextItem[];
  updatedAt: number;
};

export type Project = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  pages: PageData[];
};

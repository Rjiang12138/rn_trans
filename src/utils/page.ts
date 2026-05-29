import {Skia} from '@shopify/react-native-skia';
import type {PaintPoint, PageData, TextItem} from '../types';

export const clonePage = (page: PageData): PageData =>
  JSON.parse(JSON.stringify(page)) as PageData;

export const toSvgPath = (points: PaintPoint[]) => {
  if (points.length === 0) {
    return '';
  }
  if (points.length === 1) {
    const p = points[0];
    return `M ${p.x} ${p.y} L ${p.x + 0.01} ${p.y + 0.01}`;
  }
  return points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ');
};

export const createParagraph = (textItem: TextItem, maxWidth = 300) => {
  const builder = Skia.ParagraphBuilder.Make();
  builder.pushStyle({
    color: Skia.Color(textItem.style.color),
    fontSize: textItem.style.fontSize,
    fontStyle: {
      weight: textItem.style.fontWeight === 'bold' ? 700 : 400,
    },
    letterSpacing: textItem.style.letterSpacing,
    heightMultiplier:
      textItem.style.fontSize > 0
        ? textItem.style.lineHeight / textItem.style.fontSize
        : 1.2,
  });
  builder.addText(textItem.text || '');
  builder.pop();
  const paragraph = builder.build();
  paragraph.layout(maxWidth);
  return paragraph;
};

export const estimateTextBounds = (item: TextItem) => {
  const width = Math.max(60, item.text.length * item.style.fontSize * 0.6);
  const height = Math.max(item.style.lineHeight, item.style.fontSize * 1.2);
  return {x: item.x, y: item.y, width, height};
};

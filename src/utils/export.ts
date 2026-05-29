import {
  ImageFormat,
  PaintStyle,
  Skia,
  StrokeCap,
  StrokeJoin,
} from '@shopify/react-native-skia';
import RNFS from 'react-native-fs';
import {getRootDir} from '../storage/storage';
import {createParagraph, toSvgPath} from './page';
import type {Project} from '../types';

const normalizeUri = (path: string) =>
  path.startsWith('file://') ? path : `file://${path}`;

export const exportProjectPages = async (project: Project): Promise<string> => {
  const exportDir = `${getRootDir()}/exports/${project.id}_${Date.now()}`;
  await RNFS.mkdir(exportDir);

  for (let i = 0; i < project.pages.length; i += 1) {
    const page = project.pages[i];
    const data = await Skia.Data.fromURI(normalizeUri(page.imagePath));
    const srcImage = data ? Skia.Image.MakeImageFromEncoded(data) : null;
    if (!srcImage) {
      continue;
    }

    const surface = Skia.Surface.MakeOffscreen(page.width, page.height);
    if (!surface) {
      continue;
    }

    const canvas = surface.getCanvas();
    const imagePaint = Skia.Paint();
    canvas.drawImageRect(
      srcImage,
      Skia.XYWHRect(0, 0, srcImage.width(), srcImage.height()),
      Skia.XYWHRect(0, 0, page.width, page.height),
      imagePaint,
    );

    page.strokes.forEach(stroke => {
      const pathData = toSvgPath(stroke.points);
      if (!pathData) {
        return;
      }
      const skPath = Skia.Path.MakeFromSVGString(pathData);
      if (!skPath) {
        return;
      }
      const paint = Skia.Paint();
      paint.setAntiAlias(true);
      paint.setColor(Skia.Color(stroke.color));
      paint.setStyle(PaintStyle.Stroke);
      paint.setStrokeWidth(stroke.size);
      paint.setStrokeCap(StrokeCap.Round);
      paint.setStrokeJoin(StrokeJoin.Round);
      canvas.drawPath(skPath, paint);
    });

    page.texts.forEach(textItem => {
      const paragraph = createParagraph(
        textItem,
        Math.max(120, page.width - textItem.x),
      );
      canvas.drawParagraph(paragraph, textItem.x, textItem.y);
    });

    const outputImage = surface.makeImageSnapshot();
    const base64 = outputImage.encodeToBase64(ImageFormat.PNG, 100);
    const outputPath = `${exportDir}/page_${String(i + 1).padStart(
      3,
      '0',
    )}.png`;
    await RNFS.writeFile(outputPath, base64, 'base64');
  }

  return exportDir;
};

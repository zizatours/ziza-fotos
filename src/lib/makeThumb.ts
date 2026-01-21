import sharp from "sharp";

export async function makeThumbWebp(inputBuffer: Buffer) {
  // thumb para grilla (ajusta a gusto)
  const WIDTH = 900;      // 600–1000 suele ser ideal
  const QUALITY = 70;     // 60–75 ok

  return sharp(inputBuffer)
    .rotate() // respeta EXIF orientation
    .resize({ width: WIDTH, withoutEnlargement: true })
    .webp({ quality: QUALITY })
    .toBuffer();
}

const sharp = require("sharp");
const { mkdirSync } = require("fs");
const { resolve } = require("path");

const ROOT = resolve(__dirname, "..");
const SRC = resolve(ROOT, "public", "maxPlan.png");

const SIZES = {
  "android/app/src/main/res/mipmap-mdpi": 48,
  "android/app/src/main/res/mipmap-hdpi": 72,
  "android/app/src/main/res/mipmap-xhdpi": 96,
  "android/app/src/main/res/mipmap-xxhdpi": 144,
  "android/app/src/main/res/mipmap-xxxhdpi": 192,
};

async function main() {
  for (const [dir, size] of Object.entries(SIZES)) {
    const outDir = resolve(ROOT, dir);
    mkdirSync(outDir, { recursive: true });

    await sharp(SRC)
      .resize(size, size, { fit: "cover" })
      .png()
      .toFile(resolve(outDir, "ic_launcher.png"));

    await sharp(SRC)
      .resize(size, size, { fit: "cover" })
      .png()
      .toFile(resolve(outDir, "ic_launcher_round.png"));

    console.log(`OK ${dir} (${size}x${size})`);
  }

  const electronDir = resolve(ROOT, "electron", "build");
  mkdirSync(electronDir, { recursive: true });

  await sharp(SRC)
    .resize(256, 256, { fit: "cover" })
    .png()
    .toFile(resolve(electronDir, "icon.png"));

  console.log("OK electron/build/icon.png (256x256)");
  console.log("Done!");
}

main().catch(console.error);

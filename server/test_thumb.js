const path = require("path");
const fs = require("fs-extra");
const sharp = require("sharp");
const { rgbaToThumbHash } = require("thumbhash");

const CACHE_DIR_NAME = ".cache";
const STORAGE_PATH = "/Users/qazz/work/client/cloudimgs/uploads";

async function generateThumbHash(filePath) {
  try {
    const dir = path.dirname(filePath);
    const filename = path.basename(filePath);
    const cacheDir = path.join(dir, CACHE_DIR_NAME);
    const cacheFile = path.join(cacheDir, `${filename}.th`);

    console.log("Generating for:", filePath);
    console.log("Cache file:", cacheFile);

    // Ensure cache dir exists
    await fs.ensureDir(cacheDir);

    // Resize to 100x100 max, get raw RGBA
    const image = sharp(filePath).resize(100, 100, { fit: 'inside' });
    const { data, info } = await image
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    const binaryHash = rgbaToThumbHash(info.width, info.height, data);
    await fs.writeFile(cacheFile, Buffer.from(binaryHash));
    console.log("Success!");
    return Buffer.from(binaryHash).toString('base64');
  } catch (err) {
    console.error(`Failed to generate thumbhash for ${filePath}:`, err);
    return null;
  }
}

// Pick a file that exists
const testFile = path.join(STORAGE_PATH, "IMG_1405.jpeg");
generateThumbHash(testFile);

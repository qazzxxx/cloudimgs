const exifr = require("exifr");
const mm = require("music-metadata");
const fs = require("fs-extra");
const path = require("path");
const sharp = require('sharp');
const { getThumbHash, generateThumbHash } = require("../utils/fileUtils");

async function parseImageMetadata(filePath) {
    try {
        const meta = await exifr.parse(filePath, {
            gps: true,
            tiff: true,
            ifd0: true,
            exif: true
        });
        return meta || {};
    } catch (e) {
        return {};
    }
}

async function parseAudioDuration(filePath) {
    try {
        const metadata = await mm.parseFile(filePath, { duration: true });
        return metadata.format.duration;
    } catch (error) {
        // console.error('解析音频时长失败:', error);
        return null;
    }
}

async function parseVideoDuration(filePath) {
    return parseAudioDuration(filePath);
}

// 组合所有信息以返回标准化的 DB 对象
async function getFileMetadata(filePath, relPath, existingStat = null) {
    const stat = existingStat || await fs.stat(filePath);
    const ext = path.extname(filePath).toLowerCase();

    let width = null;
    let height = null;
    let orientation = null;
    let metaJson = {};
    let duration = null;

    // 图片元数据 (Sharp 用于获取可靠的统计信息 + Exifr 用于获取详细信息)
    const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.tiff', '.tif', '.heif', '.heic', '.avif', '.gif', '.svg'];

    if (IMAGE_EXTS.includes(ext)) {
        // 1. Sharp 提取 (可靠的尺寸和空间信息)
        try {
            const sharpMeta = await sharp(filePath).metadata();
            width = sharpMeta.width;
            height = sharpMeta.height;
            metaJson.space = sharpMeta.space; // srgb, cmyk, 等
            metaJson.channels = sharpMeta.channels;
            metaJson.density = sharpMeta.density;
            metaJson.format = sharpMeta.format;
            metaJson.hasAlpha = sharpMeta.hasAlpha;
            orientation = sharpMeta.orientation; // Sharp 通常会标准化，但我们保留它
        } catch (e) {
            // console.log("Sharp metadata failed:", e.message);
        }

        // 2. EXIF 提取 (照片详细信息)
        // 仅适用于通常支持 EXIF 的格式
        if (['.jpg', '.jpeg', '.png', '.webp', '.tiff', '.heif', '.heic'].includes(ext)) {
            const exif = await parseImageMetadata(filePath);
            if (exif) {
                metaJson.exif = {};

                if (exif.latitude && exif.longitude) {
                    metaJson.gps = { lat: exif.latitude, lng: exif.longitude };
                    metaJson.exif.latitude = exif.latitude;
                    metaJson.exif.longitude = exif.longitude;
                }

                // 日期
                if (exif.DateTimeOriginal || exif.CreateDate) {
                    metaJson.date = exif.DateTimeOriginal || exif.CreateDate;
                    metaJson.exif.dateTimeOriginal = metaJson.date;
                }

                // 相机规格
                if (exif.Make) metaJson.exif.make = exif.Make;
                if (exif.Model) metaJson.exif.model = exif.Model;
                if (exif.LensModel) metaJson.exif.lensModel = exif.LensModel;
                if (exif.FNumber) metaJson.exif.fNumber = exif.FNumber;
                if (exif.ExposureTime) metaJson.exif.exposureTime = exif.ExposureTime;
                if (exif.ISO) metaJson.exif.iso = exif.ISO;

                // 如果 sharp 失败，回退到 exif 尺寸
                if (!width && exif.ExifImageWidth) width = exif.ExifImageWidth;
                if (!height && exif.ExifImageHeight) height = exif.ExifImageHeight;
                if (!orientation && exif.Orientation) orientation = exif.Orientation;
            }
        }
    }

    // 音频/视频时长
    if (EXT_AUDIO.includes(ext) || EXT_VIDEO.includes(ext)) {
        duration = await parseAudioDuration(filePath);
        if (duration) metaJson.duration = duration;
    }

    // Thumbhash
    let thumbhash = await getThumbHash(filePath);
    if (!thumbhash && IMAGE_EXTS.includes(ext)) {
        // 尝试生成，如果失败则忽略
        try {
            thumbhash = await generateThumbHash(filePath);
        } catch (e) { }
    }

    // 优先使用 EXIF 日期作为 upload_time (用户请求: 智能日期提取)
    // 如果我们有实际的照片拍摄日期，请使用它而不是文件创建时间 (复制/移动时会重置)
    let uploadTime = stat.birthtime;
    if (metaJson.date) {
        uploadTime = metaJson.date;
    }

    return {
        size: stat.size,
        mtime: stat.mtime.getTime(),
        upload_time: uploadTime instanceof Date ? uploadTime.toISOString() : new Date(uploadTime).toISOString(),
        width,
        height,
        orientation,
        thumbhash,
        meta_json: JSON.stringify(metaJson)
    };
}

const EXT_AUDIO = ['.mp3', '.wav', '.ogg', '.m4a', '.flac'];
const EXT_VIDEO = ['.mp4', '.webm', '.mov', '.avi', '.mkv'];

module.exports = {
    getFileMetadata,
    parseImageMetadata,
    parseAudioDuration
};

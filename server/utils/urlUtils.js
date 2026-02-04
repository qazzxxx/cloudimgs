const path = require('path');

/**
 * Formats an image object for JSON response, ensuring fullPath is an absolute URL.
 * @param {Object} req - Express request object
 * @param {Object} image - Image object (must have rel_path)
 * @returns {Object} Formatted image object
 */
function formatImageResponse(req, image) {
    // Basic validation
    if (!image || !image.rel_path) return image;

    const relPathStr = image.rel_path.split("/").map(encodeURIComponent).join("/");
    const url = `/api/images/${relPathStr}`;
    const fullPath = `${req.protocol}://${req.get('host')}${url}`;

    // Parse meta_json if it exists and is a string
    let meta = {};
    if (typeof image.meta_json === 'string') {
        try {
            meta = JSON.parse(image.meta_json);
        } catch (e) { }
    } else if (typeof image.meta_json === 'object') {
        meta = image.meta_json;
    }

    return {
        // Standard fields
        filename: image.filename,
        relPath: image.rel_path,
        fullPath: fullPath, // Absolute URL
        url: url,           // Relative API URL
        width: image.width,
        height: image.height,
        size: image.size,
        uploadTime: image.upload_time,
        mime: image.mime_type, // Some places user mime_type

        // Merge extra fields if present
        ...meta,

        // Allow overriding or adding specific fields if they exist on the input object
        // but were not in the standard list above (e.g. thumbhash)
        thumbhash: image.thumbhash,
    };
}

module.exports = {
    formatImageResponse
};

const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const logger = require('./logger');

ffmpeg.setFfmpegPath(ffmpegPath);

/**
 * Extracts a thumbnail from a video URL and returns a Buffer.
 * @param {string} videoUrl - Direct URL to the video file
 * @returns {Promise<Buffer>} - JPEG image buffer
 */
const extractThumbnail = (videoUrl) => {
  return new Promise((resolve, reject) => {
    const tmpFile = path.join(os.tmpdir(), `${crypto.randomUUID()}.jpg`);
    
    ffmpeg(videoUrl)
      .screenshots({
        timestamps: ['00:00:01.000'],
        filename: path.basename(tmpFile),
        folder: path.dirname(tmpFile),
        size: '?x720'
      })
      .on('end', () => {
        try {
          const buffer = fs.readFileSync(tmpFile);
          fs.unlinkSync(tmpFile);
          resolve(buffer);
        } catch (err) {
          logger.error('Failed to read or cleanup thumbnail', { error: err.message });
          reject(err);
        }
      })
      .on('error', (err) => {
        logger.error('ffmpeg thumbnail extraction failed', { error: err.message, videoUrl });
        reject(err);
      });
  });
};

module.exports = {
  extractThumbnail,
};

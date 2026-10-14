const cloudinary = require('cloudinary').v2;
const config = require('./env');

if (config.cloudinary.isConfigured) {
    if (process.env.CLOUDINARY_URL && !process.env.CLOUDINARY_URL.includes("<your_")) {
        cloudinary.config({
            cloudinary_url: process.env.CLOUDINARY_URL,
            secure: true,
        });
    } else {
        cloudinary.config({
            cloud_name: config.cloudinary.cloudName,
            api_key: config.cloudinary.apiKey,
            api_secret: process.env.CLOUDINARY_API_SECRET,
            secure: true,
        });
    }
}

module.exports = cloudinary;

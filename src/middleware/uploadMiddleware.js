const multer = require('multer');

const os = require('os');

// Store files in the OS temp directory (the only writable path on Vercel) before Cloudinary upload
const storage = multer.diskStorage({ destination: os.tmpdir() });

const fileFilter = (req, file, cb) => {
    if (file.fieldname === 'managerPhoto' || file.fieldname === 'image' || file.fieldname === 'storeImage' || file.fieldname === 'licenseImage') {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only images are allowed for photos!'), false);
        }
    } else {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF documents are allowed for legal/bank files!'), false);
        }
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 4 * 1024 * 1024 // 4MB limit (Vercel request bodies are capped at 4.5MB)
    }
});

module.exports = upload;

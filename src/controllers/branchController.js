const branchService = require("../services/branchService");
const cloudinary = require("../config/cloudinary");

const createBranch = async (req, res, next) => {
    try {
        const branch = await branchService.createBranch(req.body);
        res.status(201).json(branch);
    } catch (err) {
        next(err);
    }
};

const getAllBranches = async (req, res, next) => {
    try {
        const branches = await branchService.getBranches();
        res.status(200).json(branches);
    } catch (err) {
        next(err);
    }
};

const getBranchById = async (req, res, next) => {
    try {
        const branch = await branchService.getBranchById(req.params.id, req.user);
        if (!branch) return res.status(404).json({ message: "Branch not found" });
        res.status(200).json(branch);
    } catch (err) {
        next(err);
    }
};

const getMyBranch = async (req, res, next) => {
    try {
        const managerId = req.user.id || req.user._id;

        const branch = await branchService.getBranchByManagerId(managerId);

        if (!branch) {

            return res.json(null); // Return 200 with null — frontend checks for this
        }


        res.status(200).json(branch);
    } catch (err) {
        next(err);
    }
};

const updateBranch = async (req, res, next) => {
    try {
        const updatedBranch = await branchService.updateBranch(req.params.id, req.body);
        res.status(200).json(updatedBranch);
    } catch (err) {
        next(err);
    }
};

const deleteBranch = async (req, res, next) => {
    try {
        await branchService.deleteBranch(req.params.id);
        res.status(200).json({ message: "Branch deleted successfully" });
    } catch (err) {
        next(err);
    }
};

const onboardBranch = async (req, res, next) => {
    try {
        const branchData = { ...req.body, managerId: req.user.id || req.user._id };
        const branch = await branchService.onboardBranch(branchData);
        res.status(201).json(branch);
    } catch (err) {
        // Handle 5-day cooldown after rejection
        if (err.statusCode === 429) {
            return res.status(429).json({
                error: err.message,
                daysRemaining: err.daysRemaining
            });
        }
        // Handle Prisma unique constraint violation (e.g. restaurant name already taken)
        if (err.code === 'P2002') {
            const field = err.meta?.target?.[0];
            const message = field === 'name'
                ? 'A restaurant with this name already exists. Please choose a different name.'
                : 'This account is already linked to a branch. Please contact support.';
            return res.status(409).json({ error: message });
        }
        next(err);
    }
};


const toggleVisibility = async (req, res, next) => {
    try {
        if (typeof req.body?.isVisible !== 'boolean') {
            return res.status(400).json({ error: "isVisible must be a boolean" });
        }
        const updatedBranch = await branchService.toggleVisibility(req.params.id, req.body.isVisible, req.user);
        res.status(200).json(updatedBranch);
    } catch (err) {
        if (err.statusCode) {
            return res.status(err.statusCode).json({ error: err.message, message: err.message });
        }
        next(err);
    }
};

async function validateFileSignature(filePath, fieldname) {
    const fs = require('fs').promises;
    let handle;
    try {
        handle = await fs.open(filePath, 'r');
        const buffer = Buffer.alloc(16);
        const { bytesRead } = await handle.read(buffer, 0, 16, 0);
        if (bytesRead < 4) return false;

        const isImage = (
            // JPEG: FF D8 FF
            (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) ||
            // PNG: 89 50 4E 47
            (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) ||
            // GIF: 47 49 46
            (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) ||
            // WEBP: RIFF....WEBP (52 49 46 46 .... 57 45 42 50)
            (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
             buffer.subarray(8, 12).toString('ascii') === 'WEBP')
        );

        const isPdf = (
            // PDF: %PDF (25 50 44 46)
            buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46
        );

        if (fieldname === 'managerPhoto' || fieldname === 'image' || fieldname === 'storeImage' || fieldname === 'licenseImage') {
            return isImage;
        } else {
            return isPdf;
        }
    } catch {
        return false;
    } finally {
        if (handle) await handle.close();
    }
}

const uploadDocuments = async (req, res, next) => {
    const fs = require('fs').promises;
    const files = req.files;
    const uploadedItems = [];

    if (files) {
        for (const key of Object.keys(files)) {
            if (files[key] && files[key][0] && files[key][0].path) {
                uploadedItems.push({
                    path: files[key][0].path,
                    fieldname: files[key][0].fieldname
                });
            }
        }
    }

    try {
        const config = require("../config/env");
        if (!config.cloudinary.isConfigured) {
            return res.status(503).json({
                error: "Document upload service is unavailable: Cloudinary storage is not configured on this server."
            });
        }

        // Validate true binary magic numbers
        for (const item of uploadedItems) {
            const isValid = await validateFileSignature(item.path, item.fieldname);
            if (!isValid) {
                return res.status(400).json({
                    error: `Invalid file content for ${item.fieldname}: signature does not match allowed file type.`
                });
            }
        }

        const urls = {};
        if (files) {
            for (const key of Object.keys(files)) {
                const file = files[key][0];
                const subdir = file.fieldname === 'managerPhoto' ? 'profiles' : 'docs';
                // Upload to Cloudinary
                const result = await cloudinary.uploader.upload(file.path, {
                    folder: `sweet-shop/${subdir}`,
                    resource_type: 'auto'
                });

                urls[key] = result.secure_url;
            }
        }

        res.status(200).json({ urls });
    } catch (err) {
        next(err);
    } finally {
        // Guarantee cleanup of every temporary file, even on upload error or validation failure
        for (const item of uploadedItems) {
            try {
                await fs.unlink(item.path);
            } catch {
                // Ignore if already deleted
            }
        }
    }
};


const verifyBranch = async (req, res, next) => {
    try {
        const verifiedBranch = await branchService.verifyBranch(req.params.id, req.body.status, req.body.reason);
        res.status(200).json(verifiedBranch);
    } catch (err) {
        next(err);
    }
};

const getPublicBranches = async (req, res, next) => {
    try {
        const branches = await branchService.getPublicBranches();
        res.status(200).json(branches);
    } catch (err) {
        next(err);
    }
};

module.exports = {
    createBranch,
    getAllBranches,
    getBranchById,
    getMyBranch,
    updateBranch,
    deleteBranch,
    onboardBranch,
    uploadDocuments,
    toggleVisibility,
    verifyBranch,
    getPublicBranches
};

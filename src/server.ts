import { exec } from "child_process";
import { v4 as uuidv4 } from "uuid";
import jwt from "jsonwebtoken";
import express from "express";
import mime from "mime-types";
import helmet from "helmet";
import multer from "multer";
import dotenv from "dotenv";
import axios from "axios";
import path from "path";
import fs from "fs";

import { allowedMimes } from "./helper"
import { startFileCleanup } from "./file-cleanup";

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;
const jwtSecret = process.env.JWT_SECRET || "";
const baseUrl = process.env.BASE_URL || `http://localhost:${port}`;

const uploadDir = path.resolve("uploads");
const outputDir = path.resolve("converted");

if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

app.use(express.json({ limit: "1gb" }));
app.use(express.urlencoded({ limit: "1gb", extended: true }));

app.use(helmet());
app.use(express.json());

// Generate static admin token (no expiration)
const adminToken = jwt.sign({ role: "admin" }, jwtSecret);
// console.log(`🔑 Your static API token (keep it secret):\n${adminToken}\n`);

// JWT verification middleware
function verifyToken(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
) {
    const headerKey = req.headers["api-key"];

    // Handle array or missing header safely
    const token = Array.isArray(headerKey) ? headerKey[0] : headerKey;

    if (!token) {
        return res.status(401).json({ error: "Token missing or invalid token" });
    }

    try {
        jwt.verify(token, jwtSecret);
        next();
    } catch {
        return res.status(401).json({ error: "Unauthorized" });
    }
}

//  Multer setup (upload config)
const storage = multer.diskStorage({
    destination: (_, __, cb) => cb(null, "uploads/"),
    filename: (_, file, cb) => {
        const uniqueName = `${uuidv4()}-${file.originalname}`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 1024 * 1024 * 1024 }, // 100 mb
    fileFilter: (_, file, cb) => {
        if (allowedMimes.includes(file.mimetype)) cb(null, true);
        else cb(new Error("Invalid file type"));
    }
});

// Convert API
app.post("/api/convert", verifyToken, upload.single("file"), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const inputFile = path.resolve(req.file.path);
    const originalFileName = req.file.filename;
    const outputFileName = `${path.parse(originalFileName).name}.svg`;
    const outputFile = path.join(outputDir, outputFileName);

    const command = `inkscape "${inputFile}" --export-type=svg --export-filename="${outputFile}"`;

    exec(command, (error, _, stderr) => {
        if (error) {
            console.error("Inkscape error:", stderr);
            fs.unlinkSync(inputFile);
            return res.status(500).json({ error: "Conversion failed", details: stderr });
        }

        const originalFileUrl = `${baseUrl}/files/${originalFileName}`;
        const convertedFileUrl = `${baseUrl}/files/${outputFileName}`;

        return res.json({
            success: true,
            message: "File converted successfully",
            files: {
                original: originalFileUrl,
                converted: convertedFileUrl
            }
        });
    });
});

// Convert from URL API
app.post("/api/convert-url", verifyToken, async (req, res) => {
    const { fileUrl } = req.body;
    if (!fileUrl) return res.status(400).json({ error: "fileUrl is required" });

    try {
        // Get original filename from URL
        const originalFilename = path.basename(fileUrl.split("?")[0]);
        const uniqueFilename = `${uuidv4()}-${originalFilename}`;
        const inputFile = path.join(uploadDir, uniqueFilename);

        // Download file
        const response = await axios.get(fileUrl, { responseType: "arraybuffer" });
        const contentType = response.headers["content-type"] || "";
        if (!allowedMimes.includes(contentType)) {
            return res.status(400).json({ error: "File type not allowed" });
        }

        fs.writeFileSync(inputFile, Buffer.from(response.data));

        // Convert with Inkscape
        const outputFileName = `${path.parse(uniqueFilename).name}.svg`;
        const outputFile = path.join(outputDir, outputFileName);
        const command = `inkscape "${inputFile}" --export-type=svg --export-filename="${outputFile}"`;

        exec(command, (error, _, stderr) => {
            if (error) {
                console.error("Inkscape error:", stderr);
                fs.unlinkSync(inputFile);
                return res.status(500).json({ error: "Conversion failed", details: stderr });
            }

            const originalFileUrl = `${baseUrl}/files/${uniqueFilename}`;
            const convertedFileUrl = `${baseUrl}/files/${outputFileName}`;

            return res.json({
                success: true,
                message: "File converted successfully",
                files: {
                    original: originalFileUrl,
                    converted: convertedFileUrl
                }
            });
        });
    } catch (err: any) {
        console.error(err);
        return res.status(500).json({ error: err.message || "Conversion failed" });
    }
});


// Secure file download (JWT required)
app.get("/files/:filename", verifyToken, (req, res) => {
    const { filename } = req.params;
    const filePath =
        fs.existsSync(path.join(uploadDir, filename))
            ? path.join(uploadDir, filename)
            : fs.existsSync(path.join(outputDir, filename))
                ? path.join(outputDir, filename)
                : null;

    if (!filePath) return res.status(404).json({ error: "File not found" });

    const mimeType = mime.lookup(filePath) || "application/octet-stream";
    res.setHeader("Content-Type", mimeType);
    res.sendFile(filePath);
});

// Fallback
app.use((_, res) => res.status(404).json({ error: "URL Not found" }));

// file clean up interval start
startFileCleanup(uploadDir, outputDir);

app.listen(port, () => {
    console.log(`SVG Converter API server running on ${baseUrl}`);
});

import fs from "fs";
import path from "path";

export const CLEANUP_INTERVAL = 30 * 60 * 1000; // 5 minutes
export const FILE_TTL = 30 * 60 * 1000;        // 30 minutes

export const startFileCleanup = (uploadDir: string, outputDir: string) => {

    const cleanupOldFiles = () => {
        fs.readdir(uploadDir, (err, files) => {
            if (err) return console.error("Cleanup error:", err);

            files.forEach((file) => {
                const uploadFilePath = path.join(uploadDir, file);
                fs.stat(uploadFilePath, (err, stats) => {
                    if (err) return console.error(err);
                    const now = Date.now();
                    const createdAt = stats.birthtimeMs;

                    if (now - createdAt > FILE_TTL) {
                        // Delete uploaded file
                        fs.unlink(uploadFilePath, (err) => {
                            if (err) console.error("Failed to delete uploaded file:", uploadFilePath, err);
                            else console.log("Deleted uploaded file:", uploadFilePath);
                        });

                        // Delete corresponding converted file
                        const convertedFileName = `${path.parse(file).name}.svg`;
                        const convertedFilePath = path.join(outputDir, convertedFileName);
                        if (fs.existsSync(convertedFilePath)) {
                            fs.unlink(convertedFilePath, (err) => {
                                if (err) console.error("Failed to delete converted file:", convertedFilePath, err);
                                else console.log("Deleted converted file:", convertedFilePath);
                            });
                        }
                    }
                });
            });
        });
    }

    // Start cleanup loop
    setInterval(cleanupOldFiles, CLEANUP_INTERVAL);
    console.log("File cleanup service started");
}

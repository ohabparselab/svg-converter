export function uniqueId(): string {
    const now = new Date();
    const date = now.toISOString().slice(0, 10).replace(/-/g, "");
    const time = now.toTimeString().slice(0, 8).replace(/:/g, "");
    const rand = Math.random().toString(36).slice(2, 6);
    return `${date}-${time}-${rand}`;
}

const epsMimes = new Set([
    "application/postscript",
    "application/eps",
    "application/x-eps",
    "image/x-eps",
]);

export function isEpsMime(mime: string): boolean {
    return epsMimes.has(mime);
}

export const allowedMimes = [
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/bmp",
    "image/gif",
    "image/tiff",
    "image/webp",
    "image/svg+xml",
    "application/pdf",
    "application/postscript",
    "application/eps",
    "application/x-eps",
    "image/x-eps",
    "image/x-dxf",
    "application/x-dxf",
    "application/dxf",
    "image/x-wmf",
    "image/x-emf",
    "application/vnd.corel-draw",
    "application/illustrator",
    "application/x-illustrator",
    "application/x-xfig",
    "application/x-dia-diagram",
    "application/x-skencil",
    "image/x-cgm",
    "application/x-msmetafile",
    "text/plain",
    "application/hpgl",
    "application/vnd.hp-hpgl"
];
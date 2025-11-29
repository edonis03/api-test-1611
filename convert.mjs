import ffmpegPath from 'ffmpeg-static';
import { spawn } from 'child_process';
import path from 'path';

const args = process.argv.slice(2);

if (args.length < 2) {
    console.error("Uso: node convert.js input.webm output.mp3");
    process.exit(1);
}

const inputFile = args[0];
const outputFile = args[1];

console.log("⏳ Avvio conversione con ffmpeg-static...");
console.log("📥 File input:", inputFile);
console.log("🎧 File output:", outputFile);

const ffmpeg = spawn(ffmpegPath, [
    "-i", inputFile,
    "-vn",
    "-c:a", "libmp3lame",
    "-b:a", "192k",
    outputFile
]);

ffmpeg.stdout.on('data', data => console.log(data.toString()));
ffmpeg.stderr.on('data', data => console.log(data.toString()));

ffmpeg.on('close', code => {
    if (code === 0) {
        console.log("✔ Conversione completata:", outputFile);
    } else {
        console.error("❌ Errore nella conversione, codice:", code);
    }
});

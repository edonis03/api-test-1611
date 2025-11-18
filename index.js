import express from 'express';
import youtubedl from 'youtube-dl-exec';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import ffmpegPath from 'ffmpeg-static';

process.env.YOUTUBE_DL_EXEC_PATH = path.resolve('./bin/yt-dlp');
const cookiesPath = path.resolve('./cookies.txt'); // percorso del tuo cookies.txt

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 9090;

// Downloads folder
const downloadsPath = path.join(process.cwd(), 'downloads');
if (!fs.existsSync(downloadsPath)) fs.mkdirSync(downloadsPath);

// EJS
app.set('view engine', 'ejs');
app.set('views', path.join(process.cwd(), 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use('/downloads', express.static(downloadsPath));

// Helper: list MP3 files
function getDownloadedFiles() {
    return fs.readdirSync(downloadsPath).filter(f => f.endsWith(".mp3"));
}

// Home
app.get('/', (req, res) => {
    res.render('index', { 
        message: null, 
        files: getDownloadedFiles() 
    });
});

// Download audio (NO FFMPEG)
app.post('/download', async (req, res) => {
    const url = req.body.url;
    if (!url) {
        return res.json({ 
            message: "Please enter a URL!", 
            files: getDownloadedFiles() 
        });
    }

    // 🔥 IMPORTANT: remove extractAudio & audioFormat (FFmpeg required)
    const output = path.resolve(downloadsPath, "%(title)s.%(ext)s");

    try {
        await youtubedl(url, {
            extractAudio: true,
            audioFormat: 'mp3',
            ffmpegLocation: ffmpegPath,
            cookies: cookiesPath, // <-- qui usi i cookie
            output
        });

        res.json({
            message: "Audio downloaded successfully! Converting to MP3...",
            files: getDownloadedFiles()
        });

    } catch (err) {
        console.error(err);
        res.json({
            message: "Failed to download audio.",
            files: getDownloadedFiles()
        });
    }
});



// Delete file
app.post('/delete/:filename', (req, res) => {
    const filename = req.params.filename;

    if (filename.includes("..")) {
        return res.status(400).json({
            message: "Invalid filename.",
            files: getDownloadedFiles()
        });
    }

    const filePath = path.join(downloadsPath, filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    res.json({
        message: `File "${filename}" deleted successfully!`,
        files: getDownloadedFiles()
    });
});

// Start server
app.listen(PORT, () =>
    console.log(`Server running at http://localhost:${PORT}`)
);

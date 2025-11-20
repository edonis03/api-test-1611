import express from 'express';
import youtubedl from 'youtube-dl-exec';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import ffmpegPath from 'ffmpeg-static';

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

// Ricerca per titolo
app.post("/search", async (req, res) => {
    const query = req.body.query;
    if (!query) return res.json({ message: "Inserisci un titolo!" });

    try {

        process.env.YOUTUBE_DL_EXEC_PATH = path.resolve('./bin/yt-dlp');

        const result = await youtubedl(`ytsearch5:${query}`, {
            dumpSingleJson: true,
            noCheckCertificates: true,
            skipDownload: true,
            noWarnings: true,
            preferFreeFormats: true,
            cookies: cookiesPath,
            addHeader: [
            "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36"
            ]

        });

        const entries = result.entries || [];
        const videos = entries.map(v => ({
            id: v.id,
            title: v.title ? v.title.replace(/\s*\([^)]*\)/g, "") : "Sconosciuto",
            thumbnail: v.thumbnail || ""
        }));

        res.json({ message: "Risultati trovati", videos });

    } catch (err) {
        console.error(err);
        res.json({ message: "Errore nella ricerca", videos: [] });
    }
});



app.post("/download", async (req, res) => {

    const id = req.body.id;
    const url = req.body.query;

    const videoUrl = id ? `https://www.youtube.com/watch?v=${id}` : url;

    if (!videoUrl) return res.json({ message: "Nessun video selezionato" });

    try {

        process.env.YOUTUBE_DL_EXEC_PATH = path.resolve('./bin/yt-dlp');

        // 1. Recupera le info del video
        const info = await youtubedl(videoUrl, {
            dumpSingleJson: true,
            noCheckCertificates: true,
            noWarnings: true,
            preferFreeFormats: true,
            cookies: cookiesPath,
            addHeader: [
            "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36"
            ]

        });

        // 2. Pulisci il titolo e rimuovi caratteri non validi
        let title = info.title.replace(/\s*\([^)]*\)/g, "").trim();
        title = title.replace(/[<>:"/\\|?*]/g, ""); // 🔑

        // 3. Nome file semplice
        const filename = `${title}.mp3`;

        process.env.YOUTUBE_DL_EXEC_PATH = path.resolve('./bin/yt-dlp');
        
        // 4. Scarica l’audio
        await youtubedl(videoUrl, {
            extractAudio: true,
            audioFormat: "mp3",
            output: filename,
            cookies: cookiesPath,
            addHeader: [
            "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36"
            ]

        });

        // 5. Invia il file e poi elimina
        
        res.setHeader("X-Video-Title", title);

        res.download(filename, `${title}.mp3`, (err) => {
            if (err) console.error("Errore nell'invio:", err);
            fs.unlink(filename, (unlinkErr) => {
                if (unlinkErr) console.error("Errore nell'eliminazione:", unlinkErr);
            });
        });

    } catch (err) {
        console.error(err);
        res.json({ message: "Errore nel download" });
    }
});


// Start server
app.listen(PORT, () =>
    console.log(`Server running at http://localhost:${PORT}`)
);

import os
import subprocess
import time
from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
import yt_dlp

app = FastAPI()
BASE_DIR = os.getcwd()
DOWNLOADS_PATH = os.path.join(BASE_DIR, "downloads")
os.makedirs(DOWNLOADS_PATH, exist_ok=True)

templates = Jinja2Templates(directory="templates")
app.mount("/downloads", StaticFiles(directory=DOWNLOADS_PATH), name="downloads")

# ============================================================
# FUNZIONE CONVERSIONE
# ============================================================

def convert_to_mp3(input_file: str, output_file: str):
    """Converte un file webm in mp3 usando Node + ffmpeg-static"""
    try:
        subprocess.run(
            ["node", "convert.mjs", input_file, output_file],
            check=True
        )
        return output_file
    except subprocess.CalledProcessError as e:
        print("Errore conversione:", e)
        return None

# ============================================================
# ATTENDI CHE IL DOWNLOAD FINISCA
# ============================================================

def wait_for_file(filename: str, timeout=60):
    """Aspetta che il file smetta di crescere (download completato)"""
    start_time = time.time()
    last_size = -1
    while True:
        if os.path.exists(filename):
            size = os.path.getsize(filename)
            if size == last_size:
                return filename
            last_size = size
        if time.time() - start_time > timeout:
            raise TimeoutError("Download non completato")
        time.sleep(1)

# ============================================================
# SEARCH
# ============================================================

class SearchBody(BaseModel):
    query: str

@app.post("/search")
async def search(body: SearchBody):
    query = body.query
    if not query:
        return JSONResponse({"message": "Query mancante"}, status_code=400)

    try:
        ydl_opts = {
            "quiet": True,
            "skip_download": True,
            "nocheckcertificate": True,
            "cookies": "cookies.txt",
            "default_search": "ytsearch5",
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            data = ydl.extract_info(query, download=False)

        videos = []
        for entry in data.get("entries", []):
            thumb = entry.get("thumbnails", [{}])[-1].get("url")
            videos.append({
                "id": entry.get("id"),
                "title": entry.get("title"),
                "thumbnail": thumb,
                "duration": entry.get("duration"),
                "uploader": entry.get("uploader")
            })

        return {"videos": videos}

    except Exception as e:
        print("Errore SEARCH:", e)
        return JSONResponse({"message": str(e)})

# ============================================================
# DOWNLOAD + CONVERSIONE + SERVIZIO
# ============================================================

class DownloadBody(BaseModel):
    id: str | None = None
    query: str | None = None

@app.post("/download")
async def download(body: DownloadBody):
    video_url = f"https://www.youtube.com/watch?v={body.id}" if body.id else body.query
    if not video_url:
        return JSONResponse({"message": "Nessun video selezionato"})

    try:
        # Scarico audio/video
        ydl_opts = {
            "format": "bestaudio/best",
            "outtmpl": os.path.join(DOWNLOADS_PATH, "%(title)s.%(ext)s"),
            "quiet": True,
            "cookies": "cookies.txt",
            "nocheckcertificate": True,
            "nopart": True  # niente file .part
        }

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(video_url, download=True)

        filename = ydl.prepare_filename(info)
        final_file = wait_for_file(filename)
        mp3_output = os.path.splitext(final_file)[0] + ".mp3"

        # Converto subito in MP3
        convert_to_mp3(final_file, mp3_output)

        # Elimino il file originale
        os.remove(final_file)

        # Servizio file al browser e cancellazione dopo invio
        return FileResponse(
            mp3_output,
            media_type="audio/mpeg",
            filename=os.path.basename(mp3_output),
            background=lambda: os.remove(mp3_output)  # elimina dopo download
        )

    except Exception as e:
        print("Errore DOWNLOAD:", e)
        return JSONResponse({"message": str(e)})

# ============================================================
# HOME
# ============================================================

@app.get("/", response_class=HTMLResponse)
def home(request: Request):
    files = os.listdir(DOWNLOADS_PATH)
    return templates.TemplateResponse("index.html", {"request": request, "files": files})

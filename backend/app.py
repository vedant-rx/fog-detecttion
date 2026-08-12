import os
import csv
import time
import shutil
import threading
from datetime import datetime
from queue import Queue

import cv2
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

from dehaze import dehaze_image, compute_metrics, draw_detections, _detect_objects, _HIGHWAY_CLASSES


# ===========================================================================
# CONFIGURATION
# ===========================================================================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_DIR    = os.path.join(BASE_DIR, "uploads")
DEHAZED_DIR   = os.path.join(BASE_DIR, "dehazed")
ANNOTATED_DIR = os.path.join(BASE_DIR, "annotated")
PREVIEW_DIR   = os.path.join(BASE_DIR, "previews")   # cached mode-comparison thumbnails
CSV_PATH      = os.path.join(BASE_DIR, "sensor_log.csv")

# Gallery: images the user has locally that they want to process from the UI
# Points to the backend folder itself where test images (foggy*.jpg, fp*.jpeg…) live
GALLERY_DIR   = BASE_DIR
_GALLERY_EXTS  = {".jpg", ".jpeg", ".png", ".webp"}

DEHAZE_MODE = "natural"
FOG_HUMIDITY_THRESHOLD = 90.0

# CSV columns — includes 'map', YOLO detection counts and annotated filenames
CSV_HEADERS = [
    "timestamp", "temperature_c", "humidity_percent",
    "fog_detected", "image_filename", "dehazed_filename",
    "annotated_hazy_filename", "annotated_dehazed_filename",
    "processing_time_ms",
    "entropy_hazy", "entropy_dehazed", "entropy_gain", "ssim", "map",
    "detected_hazy", "detected_dehazed",
]

os.makedirs(UPLOAD_DIR,    exist_ok=True)
os.makedirs(DEHAZED_DIR,   exist_ok=True)
os.makedirs(ANNOTATED_DIR, exist_ok=True)
os.makedirs(PREVIEW_DIR,   exist_ok=True)

if not os.path.exists(CSV_PATH):
    with open(CSV_PATH, "w", newline="") as f:
        csv.writer(f).writerow(CSV_HEADERS)


# ===========================================================================
# FLASK APP
# ===========================================================================
app = Flask(__name__)
CORS(app)


# ===========================================================================
# THREAD-SAFE STATE
# ===========================================================================
_state_lock = threading.Lock()
_latest = {
    "timestamp": None,
    "temperature_c": None,
    "humidity_percent": None,
    "fog_detected": False,
    "image_filename": None,
    "dehazed_filename": None,
    "annotated_hazy_filename": None,
    "annotated_dehazed_filename": None,
    "processing_time_ms": None,
    "entropy_hazy": None,
    "entropy_dehazed": None,
    "entropy_gain": None,
    "ssim": None,
    "map": None,
    "detected_hazy": {},
    "detected_dehazed": {},
}

_processing_queue = Queue()
_busy = threading.Event()


import json as _json


# ===========================================================================
# HELPERS
# ===========================================================================
def _is_fog_detected(humidity):
    try:
        return float(humidity) >= FOG_HUMIDITY_THRESHOLD
    except (TypeError, ValueError):
        return False


def _log_to_csv(row):
    with open(CSV_PATH, "a", newline="") as f:
        csv.writer(f).writerow([row.get(c, "") for c in CSV_HEADERS])


def _process_image(hazy_path, dehazed_path, annotated_hazy_path, annotated_dehazed_path, mode=None):
    """Run dehazing + compute metrics + save annotated detection images."""
    effective_mode = mode if mode in ("natural", "strong", "clahe") else DEHAZE_MODE
    hazy = cv2.imread(hazy_path)
    if hazy is None:
        raise ValueError(f"could not read image: {hazy_path}")
    dehazed = dehaze_image(hazy, mode=effective_mode)
    cv2.imwrite(dehazed_path, dehazed)

    # Run YOLO on both images for annotation
    hazy_boxes, hazy_scores, hazy_cls       = _detect_objects(hazy)
    dehazed_boxes, dehazed_scores, deh_cls  = _detect_objects(dehazed)

    # Draw and save annotated images
    ann_hazy    = draw_detections(hazy,    hazy_boxes,    hazy_scores,    hazy_cls,    _HIGHWAY_CLASSES)
    ann_dehazed = draw_detections(dehazed, dehazed_boxes, dehazed_scores, deh_cls,     _HIGHWAY_CLASSES)
    cv2.imwrite(annotated_hazy_path,    ann_hazy)
    cv2.imwrite(annotated_dehazed_path, ann_dehazed)

    metrics = compute_metrics(hazy, dehazed)
    return metrics


def _worker_loop():
    while True:
        job = _processing_queue.get()
        if job is None:
            break

        _busy.set()
        try:
            hazy_path    = job["hazy_path"]
            dehazed_path = job["dehazed_path"]
            ann_hazy_path    = job["annotated_hazy_path"]
            ann_dehazed_path = job["annotated_dehazed_path"]
            row = job["row"]

            start = time.time()
            metrics = _process_image(
                hazy_path, dehazed_path, ann_hazy_path, ann_dehazed_path,
                mode=job.get("mode"),
            )
            elapsed_ms = int((time.time() - start) * 1000)

            row["processing_time_ms"] = elapsed_ms
            row.update(metrics)

            with _state_lock:
                _latest.update({
                    "timestamp": row["timestamp"],
                    "temperature_c": row["temperature_c"],
                    "humidity_percent": row["humidity_percent"],
                    "fog_detected": row["fog_detected"],
                    "image_filename": row["image_filename"],
                    "dehazed_filename": row["dehazed_filename"],
                    "annotated_hazy_filename":    row["annotated_hazy_filename"],
                    "annotated_dehazed_filename": row["annotated_dehazed_filename"],
                    "processing_time_ms": elapsed_ms,
                    "entropy_hazy": metrics["entropy_hazy"],
                    "entropy_dehazed": metrics["entropy_dehazed"],
                    "entropy_gain": metrics["entropy_gain"],
                    "ssim": metrics["ssim"],
                    "map": metrics["map"],
                    "detected_hazy": metrics.get("detected_hazy", {}),
                    "detected_dehazed": metrics.get("detected_dehazed", {}),
                })

            # Serialize detection dicts to JSON strings for CSV
            row["detected_hazy"] = _json.dumps(metrics.get("detected_hazy", {}))
            row["detected_dehazed"] = _json.dumps(metrics.get("detected_dehazed", {}))

            _log_to_csv(row)

            print(f"[OK] {row['image_filename']} processed in {elapsed_ms}ms "
                  f"(temp={row['temperature_c']}C humidity={row['humidity_percent']}% "
                  f"fog={row['fog_detected']}) "
                  f"| entropy: {metrics['entropy_hazy']} -> {metrics['entropy_dehazed']} "
                  f"(gain {metrics['entropy_gain']:+.3f}) "
                  f"| SSIM: {metrics['ssim']} | mAP: {metrics['map']} "
                  f"| hazy: {metrics.get('detected_hazy',{})} "
                  f"| dehazed: {metrics.get('detected_dehazed',{})}")

        except Exception as e:
            print(f"[ERROR] processing failed: {e}")
        finally:
            _busy.clear()
            _processing_queue.task_done()


_worker_thread = threading.Thread(target=_worker_loop, daemon=True)
_worker_thread.start()


# ===========================================================================
# ROUTES
# ===========================================================================
@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "busy": _busy.is_set(),
        "queue_size": _processing_queue.qsize(),
        "mode": DEHAZE_MODE,
    })


@app.route("/upload", methods=["POST"])
def upload():
    if "image" not in request.files:
        return jsonify({"error": "no 'image' file in request"}), 400

    img_file = request.files["image"]
    if img_file.filename == "":
        return jsonify({"error": "empty filename"}), 400

    try:
        temp = float(request.form.get("temperature", "nan"))
        hum = float(request.form.get("humidity", "nan"))
    except ValueError:
        return jsonify({"error": "invalid temperature or humidity"}), 400

    now = datetime.now()
    ts = now.strftime("%Y%m%d_%H%M%S")
    iso_ts = now.strftime("%Y-%m-%d %H:%M:%S")
    fname              = f"img_{ts}.jpg"
    dehazed_fname      = f"dehazed_{ts}.jpg"
    ann_hazy_fname     = f"ann_hazy_{ts}.jpg"
    ann_dehazed_fname  = f"ann_dehazed_{ts}.jpg"

    hazy_path         = os.path.join(UPLOAD_DIR,    fname)
    dehazed_path      = os.path.join(DEHAZED_DIR,   dehazed_fname)
    ann_hazy_path     = os.path.join(ANNOTATED_DIR, ann_hazy_fname)
    ann_dehazed_path  = os.path.join(ANNOTATED_DIR, ann_dehazed_fname)
    img_file.save(hazy_path)

    fog = _is_fog_detected(hum)
    row = {
        "timestamp": iso_ts,
        "temperature_c": round(temp, 2),
        "humidity_percent": round(hum, 2),
        "fog_detected": fog,
        "image_filename": fname,
        "dehazed_filename": dehazed_fname,
        "annotated_hazy_filename":    ann_hazy_fname,
        "annotated_dehazed_filename": ann_dehazed_fname,
        "processing_time_ms": None,
        "entropy_hazy": None,
        "entropy_dehazed": None,
        "entropy_gain": None,
        "ssim": None,
        "map": None,
    }

    if _busy.is_set() and _processing_queue.qsize() >= 1:
        print(f"[SKIP] worker busy, dropping {fname}")
        row["dehazed_filename"] = ""
        _log_to_csv(row)
        return jsonify({
            "status": "skipped",
            "reason": "worker busy",
            "image_filename": fname,
        }), 202

    _processing_queue.put({
        "hazy_path":            hazy_path,
        "dehazed_path":         dehazed_path,
        "annotated_hazy_path":    ann_hazy_path,
        "annotated_dehazed_path": ann_dehazed_path,
        "row": row,
    })

    return jsonify({
        "status": "queued",
        "image_filename": fname,
        "dehazed_filename": dehazed_fname,
        "fog_detected": fog,
    }), 200


@app.route("/api/latest", methods=["GET"])
def api_latest():
    with _state_lock:
        snapshot = dict(_latest)

    if snapshot["timestamp"] is None:
        return jsonify({
            "available": False,
            "message": "no captures yet",
        })

    base_url = request.host_url.rstrip("/")
    snapshot["available"] = True
    snapshot["original_url"] = (
        f"{base_url}/api/image/original/{snapshot['image_filename']}"
    )
    snapshot["dehazed_url"] = (
        f"{base_url}/api/image/dehazed/{snapshot['dehazed_filename']}"
        if snapshot["dehazed_filename"] else None
    )
    snapshot["annotated_hazy_url"] = (
        f"{base_url}/api/image/annotated/{snapshot['annotated_hazy_filename']}"
        if snapshot.get("annotated_hazy_filename") else None
    )
    snapshot["annotated_dehazed_url"] = (
        f"{base_url}/api/image/annotated/{snapshot['annotated_dehazed_filename']}"
        if snapshot.get("annotated_dehazed_filename") else None
    )
    return jsonify(snapshot)


@app.route("/api/history", methods=["GET"])
def api_history():
    try:
        limit = int(request.args.get("limit", "20"))
    except ValueError:
        limit = 20

    if not os.path.exists(CSV_PATH):
        return jsonify({"history": []})

    rows = []
    with open(CSV_PATH, "r", newline="") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    rows.reverse()
    rows = rows[:limit]

    base_url = request.host_url.rstrip("/")
    for r in rows:
        if r.get("image_filename"):
            r["original_url"] = f"{base_url}/api/image/original/{r['image_filename']}"
        if r.get("dehazed_filename"):
            r["dehazed_url"] = f"{base_url}/api/image/dehazed/{r['dehazed_filename']}"

    return jsonify({"history": rows})


@app.route("/api/image/original/<filename>", methods=["GET"])
def serve_original(filename):
    return send_from_directory(UPLOAD_DIR, filename)


@app.route("/api/image/dehazed/<filename>", methods=["GET"])
def serve_dehazed(filename):
    return send_from_directory(DEHAZED_DIR, filename)


@app.route("/api/image/annotated/<filename>", methods=["GET"])
def serve_annotated(filename):
    return send_from_directory(ANNOTATED_DIR, filename)


# ---------------------------------------------------------------------------
# GALLERY — browse & process local images from the UI
# ---------------------------------------------------------------------------

@app.route("/api/gallery", methods=["GET"])
def api_gallery():
    """List all image files in GALLERY_DIR (backend folder) for display."""
    entries = []
    base_url = request.host_url.rstrip("/")
    try:
        for name in sorted(os.listdir(GALLERY_DIR)):
            ext = os.path.splitext(name)[1].lower()
            if ext not in _GALLERY_EXTS:
                continue
            # Skip generated output files so users only see their source images
            if name.startswith(("img_", "dehazed_", "ann_", "debug_", "test_")):
                continue
            entries.append({
                "filename": name,
                "url": f"{base_url}/api/image/gallery/{name}",
            })
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    return jsonify({"images": entries})


@app.route("/api/gallery/process/<path:filename>", methods=["POST"])
def gallery_process(filename):
    """
    Copy a gallery image into uploads/ and queue it for processing,
    exactly the same pipeline as a Pi upload.
    Accepts optional JSON body: { temperature, humidity, mode }
    Sensor data defaults: temp=25°C, humidity=95% (fog assumed).
    Mode defaults to DEHAZE_MODE ("natural").
    """
    src = os.path.join(GALLERY_DIR, filename)
    if not os.path.exists(src):
        return jsonify({"error": "file not found in gallery"}), 404

    now = datetime.now()
    ts = now.strftime("%Y%m%d_%H%M%S")
    iso_ts = now.strftime("%Y-%m-%d %H:%M:%S")

    fname              = f"img_{ts}.jpg"
    dehazed_fname      = f"dehazed_{ts}.jpg"
    ann_hazy_fname     = f"ann_hazy_{ts}.jpg"
    ann_dehazed_fname  = f"ann_dehazed_{ts}.jpg"

    hazy_path         = os.path.join(UPLOAD_DIR,    fname)
    dehazed_path      = os.path.join(DEHAZED_DIR,   dehazed_fname)
    ann_hazy_path     = os.path.join(ANNOTATED_DIR, ann_hazy_fname)
    ann_dehazed_path  = os.path.join(ANNOTATED_DIR, ann_dehazed_fname)

    # Use dummy sensor values if not provided in the POST body
    try:
        body = request.get_json(silent=True) or {}
        temp = float(body.get("temperature", 25.0))
        hum  = float(body.get("humidity",    95.0))
        mode = str(body.get("mode", DEHAZE_MODE)).lower()
        if mode not in ("natural", "strong", "clahe"):
            mode = DEHAZE_MODE
    except (ValueError, AttributeError):
        temp, hum, mode = 25.0, 95.0, DEHAZE_MODE

    shutil.copy2(src, hazy_path)

    fog = _is_fog_detected(hum)
    row = {
        "timestamp": iso_ts,
        "temperature_c": round(temp, 2),
        "humidity_percent": round(hum, 2),
        "fog_detected": fog,
        "image_filename": fname,
        "dehazed_filename": dehazed_fname,
        "annotated_hazy_filename":    ann_hazy_fname,
        "annotated_dehazed_filename": ann_dehazed_fname,
        "processing_time_ms": None,
        "entropy_hazy": None,
        "entropy_dehazed": None,
        "entropy_gain": None,
        "ssim": None,
        "map": None,
    }

    if _busy.is_set() and _processing_queue.qsize() >= 1:
        return jsonify({"status": "busy", "reason": "worker busy"}), 202

    _processing_queue.put({
        "hazy_path":              hazy_path,
        "dehazed_path":           dehazed_path,
        "annotated_hazy_path":    ann_hazy_path,
        "annotated_dehazed_path": ann_dehazed_path,
        "row": row,
        "mode": mode,
    })

    return jsonify({
        "status": "queued",
        "image_filename": fname,
        "dehazed_filename": dehazed_fname,
        "fog_detected": fog,
        "mode": mode,
        "source": filename,
    }), 200


@app.route("/api/image/gallery/<path:filename>", methods=["GET"])
def serve_gallery_image(filename):
    """Serve a raw image from the GALLERY_DIR."""
    return send_from_directory(GALLERY_DIR, filename)


@app.route("/api/gallery/preview-all/<path:filename>", methods=["GET"])
def gallery_preview_all(filename):
    """
    Generate (and cache) dehazing previews of <filename> under all three modes.
    Returns JSON:
      { natural: url, strong: url, clahe: url }
    Previews are cached in PREVIEW_DIR as <stem>_<mode>.jpg so they are only
    computed once per image.
    """
    src = os.path.join(GALLERY_DIR, filename)
    if not os.path.exists(src):
        return jsonify({"error": "file not found in gallery"}), 404

    base_url = request.host_url.rstrip("/")
    stem = os.path.splitext(filename)[0].replace("/", "_").replace(os.sep, "_")
    modes = ["natural", "strong", "clahe"]
    results = {}
    errors  = {}

    def _render_mode(m):
        cache_name = f"{stem}_{m}.jpg"
        cache_path = os.path.join(PREVIEW_DIR, cache_name)
        if not os.path.exists(cache_path):
            try:
                img = cv2.imread(src)
                if img is None:
                    raise ValueError("unreadable image")
                out = dehaze_image(img, mode=m)
                cv2.imwrite(cache_path, out)
            except Exception as exc:
                errors[m] = str(exc)
                return
        results[m] = f"{base_url}/api/image/preview/{cache_name}"

    threads = [threading.Thread(target=_render_mode, args=(m,)) for m in modes]
    for t in threads:
        t.start()
    for t in threads:
        t.join(timeout=60)

    if errors:
        return jsonify({"error": errors}), 500

    return jsonify(results)


@app.route("/api/image/preview/<path:filename>", methods=["GET"])
def serve_preview(filename):
    """Serve a cached mode-preview image."""
    return send_from_directory(PREVIEW_DIR, filename)


# ===========================================================================
# ENTRY POINT
# ===========================================================================
if __name__ == "__main__":
    print("=" * 60)
    print("Fog Enhancement Backend Server")
    print("=" * 60)
    print(f"Upload dir : {UPLOAD_DIR}")
    print(f"Dehazed dir: {DEHAZED_DIR}")
    print(f"CSV log    : {CSV_PATH}")
    print(f"Mode       : {DEHAZE_MODE}")
    print(f"Fog rule   : humidity >= {FOG_HUMIDITY_THRESHOLD}%")
    print(f"Metrics    : entropy + SSIM + mAP (YOLOv8n)")
    print("=" * 60)
    print("Listening on http://0.0.0.0:5001")
    print("=" * 60)
    app.run(host="0.0.0.0", port=5001, debug=False, threaded=True)
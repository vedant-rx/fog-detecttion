"""
app.py (v1.2 — adds Object Detection mAP)
=========================================
Flask backend server for the Fog Enhancement project.

NEW IN v1.2: returns Object Detection mAP with each capture.

Receives images + DHT22 sensor data from the Raspberry Pi rover,
runs CLAHE/DCP dehazing, computes quality metrics (entropy + SSIM + mAP),
logs everything to CSV, and serves data to the frontend dashboard.

Run with:
    python app.py

Endpoints:
    POST /upload                   - Pi uploads (image + temp + humidity)
    GET  /api/latest               - latest capture (JSON + metrics)
    GET  /api/history              - past captures
    GET  /api/image/original/<f>   - serve a hazy image
    GET  /api/image/dehazed/<f>    - serve a dehazed image
    GET  /api/health               - health check
"""

import os
import csv
import time
import threading
from datetime import datetime
from queue import Queue

import cv2
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

from dehaze import dehaze_image, compute_metrics


# ===========================================================================
# CONFIGURATION
# ===========================================================================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
DEHAZED_DIR = os.path.join(BASE_DIR, "dehazed")
CSV_PATH = os.path.join(BASE_DIR, "sensor_log.csv")

DEHAZE_MODE = "clahe"
FOG_HUMIDITY_THRESHOLD = 90.0

# CSV columns — now includes 'map'
CSV_HEADERS = [
    "timestamp", "temperature_c", "humidity_percent",
    "fog_detected", "image_filename", "dehazed_filename",
    "processing_time_ms",
    "entropy_hazy", "entropy_dehazed", "entropy_gain", "ssim", "map",
]

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(DEHAZED_DIR, exist_ok=True)

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
    "processing_time_ms": None,
    "entropy_hazy": None,
    "entropy_dehazed": None,
    "entropy_gain": None,
    "ssim": None,
    "map": None,         # NEW
}

_processing_queue = Queue()
_busy = threading.Event()


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


def _process_image(hazy_path, dehazed_path):
    """Run dehazing + compute metrics. Returns metrics dict."""
    hazy = cv2.imread(hazy_path)
    if hazy is None:
        raise ValueError(f"could not read image: {hazy_path}")
    dehazed = dehaze_image(hazy, mode=DEHAZE_MODE)
    cv2.imwrite(dehazed_path, dehazed)
    metrics = compute_metrics(hazy, dehazed)
    return metrics


def _worker_loop():
    while True:
        job = _processing_queue.get()
        if job is None:
            break

        _busy.set()
        try:
            hazy_path = job["hazy_path"]
            dehazed_path = job["dehazed_path"]
            row = job["row"]

            start = time.time()
            metrics = _process_image(hazy_path, dehazed_path)
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
                    "processing_time_ms": elapsed_ms,
                    "entropy_hazy": metrics["entropy_hazy"],
                    "entropy_dehazed": metrics["entropy_dehazed"],
                    "entropy_gain": metrics["entropy_gain"],
                    "ssim": metrics["ssim"],
                    "map": metrics["map"],
                })

            _log_to_csv(row)

            print(f"[OK] {row['image_filename']} processed in {elapsed_ms}ms "
                  f"(temp={row['temperature_c']}C humidity={row['humidity_percent']}% "
                  f"fog={row['fog_detected']}) "
                  f"| entropy: {metrics['entropy_hazy']} -> {metrics['entropy_dehazed']} "
                  f"(gain {metrics['entropy_gain']:+.3f}) "
                  f"| SSIM: {metrics['ssim']} | mAP: {metrics['map']}")

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
    fname = f"img_{ts}.jpg"
    dehazed_fname = f"dehazed_{ts}.jpg"

    hazy_path = os.path.join(UPLOAD_DIR, fname)
    dehazed_path = os.path.join(DEHAZED_DIR, dehazed_fname)
    img_file.save(hazy_path)

    fog = _is_fog_detected(hum)
    row = {
        "timestamp": iso_ts,
        "temperature_c": round(temp, 2),
        "humidity_percent": round(hum, 2),
        "fog_detected": fog,
        "image_filename": fname,
        "dehazed_filename": dehazed_fname,
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
        "hazy_path": hazy_path,
        "dehazed_path": dehazed_path,
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
    print(f"Metrics    : entropy + SSIM + mAP")
    print("=" * 60)
    print("Listening on http://0.0.0.0:5001")
    print("=" * 60)
    app.run(host="0.0.0.0", port=5001, debug=False, threaded=True)
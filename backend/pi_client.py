"""


Every 10 seconds:
  1. Reads DHT22 (temperature + humidity)
  2. Captures an image from the USB camera (with -S 20 frame skip)
  3. Uploads image + sensor data to the laptop's Flask backend
  4. Logs locally to sensor_log.csv (backup if Wi-Fi drops)

The image is also kept locally as a backup.

EDIT LAPTOP_IP below whenever the hotspot IP changes.

Required:
    pip install adafruit-circuitpython-dht requests
    sudo apt install fswebcam
"""

import csv
import os
import subprocess
import time
from datetime import datetime

import adafruit_dht
import board
import requests


# ===========================================================================
# EDIT THIS WHEN THE HOTSPOT IP CHANGES
# ===========================================================================
LAPTOP_IP = "192.168.20.173"
LAPTOP_PORT = 5001
UPLOAD_URL = f"http://{LAPTOP_IP}:{LAPTOP_PORT}/upload"
# ===========================================================================


dht = adafruit_dht.DHT22(board.D4)

csv_file = "sensor_log.csv"
if not os.path.exists(csv_file):
    with open(csv_file, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["timestamp", "temperature_c", "humidity", "image_file", "upload_status"])

print("Starting FOG Vision capture system...")
print(f"Uploading to: {UPLOAD_URL}")
print("Press Ctrl+C to stop\n")

while True:
    try:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

        # Read DHT22
        temperature = dht.temperature
        humidity = dht.humidity

        # Capture image
        image_name = f"fog_{timestamp}.jpg"
        subprocess.run([
            "fswebcam",
            "-d", "/dev/video0",
            "-r", "1920x1080",
            "--no-banner",
            "-S", "20",
            image_name
        ])

        # Upload image + sensor data to laptop (only if everything is valid)
        upload_status = "skipped"
        if (
            os.path.exists(image_name)
            and temperature is not None
            and humidity is not None
        ):
            try:
                with open(image_name, "rb") as f:
                    files = {"image": (image_name, f, "image/jpeg")}
                    data = {
                        "temperature": f"{temperature:.2f}",
                        "humidity": f"{humidity:.2f}",
                    }
                    response = requests.post(UPLOAD_URL, files=files, data=data, timeout=8)

                if response.status_code in (200, 202):
                    upload_status = "uploaded"
                else:
                    upload_status = f"server_{response.status_code}"
            except requests.exceptions.RequestException as e:
                upload_status = "network_failed"
                print(f"  Upload failed: {e}")

        # Log locally
        with open(csv_file, "a", newline="") as f:
            writer = csv.writer(f)
            writer.writerow([timestamp, temperature, humidity, image_name, upload_status])

        # Print status
        if temperature is not None and humidity is not None:
            print(f"[{timestamp}] Temp: {temperature:.1f}°C | Humidity: {humidity:.1f}% | "
                  f"Image: {image_name} | {upload_status}")
        else:
            print(f"[{timestamp}] Sensor returned None | Image: {image_name} | {upload_status}")

    except RuntimeError as e:
        print(f"Sensor error: {e}")

    time.sleep(10)
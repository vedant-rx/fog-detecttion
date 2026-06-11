"""
dehaze.py (v3.2 — adds Object Detection mAP)
============================================
Dark Channel Prior (DCP) image dehazing with comprehensive fixes for
real-world highway fog images.

NEW IN v3.2:
  - compute_map(): Object detection mAP using OpenCV's HOG person detector.
    Treats dehazed image detections as proxy ground truth.

THREE MODES:
  natural  (default) - mild DCP + all fixes
  strong             - aggressive DCP for dense fog
  clahe              - just CLAHE, no DCP (best for daytime fog)

Usage:
    from dehaze import dehaze_image, compute_metrics
    clear = dehaze_image(hazy, mode="clahe")
    metrics = compute_metrics(hazy, clear)  # includes 'map' key

Dependencies:
    pip install opencv-python opencv-contrib-python numpy
"""

import cv2
import numpy as np
import sys
import os
import time
import argparse


# ===========================================================================
# CORE DCP STEPS
# ===========================================================================
def get_dark_channel(image, patch_size=15):
    min_channel = np.min(image, axis=2)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (patch_size, patch_size))
    return cv2.erode(min_channel, kernel)


def estimate_atmospheric_light(image, dark_channel, top_percent=0.001, max_A=0.85):
    h, w = dark_channel.shape
    num_pixels = h * w
    num_top = max(int(num_pixels * top_percent), 1)
    dark_flat = dark_channel.flatten()
    image_flat = image.reshape(num_pixels, 3)
    indices = np.argpartition(dark_flat, -num_top)[-num_top:]
    brightest = image_flat[indices]
    A = np.mean(brightest, axis=0)
    return np.minimum(A, max_A)


def estimate_transmission(image, A, omega=0.85, patch_size=15):
    normalized = image / A
    dark_norm = get_dark_channel(normalized, patch_size)
    return 1.0 - omega * dark_norm


def guided_filter(guide, src, radius=80, eps=1e-3):
    try:
        guide_8bit = (guide * 255).astype(np.uint8)
        return cv2.ximgproc.guidedFilter(
            guide_8bit, src.astype(np.float32), radius, eps
        )
    except (AttributeError, cv2.error):
        return _guided_filter_manual(guide, src, radius, eps)


def _guided_filter_manual(I, p, r, eps):
    I = I.astype(np.float64)
    p = p.astype(np.float64)
    mean_I = cv2.boxFilter(I, cv2.CV_64F, (r, r))
    mean_p = cv2.boxFilter(p, cv2.CV_64F, (r, r))
    mean_Ip = cv2.boxFilter(I * p, cv2.CV_64F, (r, r))
    cov_Ip = mean_Ip - mean_I * mean_p
    mean_II = cv2.boxFilter(I * I, cv2.CV_64F, (r, r))
    var_I = mean_II - mean_I * mean_I
    a = cov_Ip / (var_I + eps)
    b = mean_p - a * mean_I
    mean_a = cv2.boxFilter(a, cv2.CV_64F, (r, r))
    mean_b = cv2.boxFilter(b, cv2.CV_64F, (r, r))
    return mean_a * I + mean_b


def recover_image(image, transmission, A, t0=0.3):
    t = np.maximum(transmission, t0)
    t = t[:, :, np.newaxis]
    J = (image - A) / t + A
    return np.clip(J, 0, 1)


# ===========================================================================
# POST-PROCESSING
# ===========================================================================
def match_luminance(original, dehazed):
    orig_lab = cv2.cvtColor(original, cv2.COLOR_BGR2LAB).astype(np.float64)
    dehaz_lab = cv2.cvtColor(dehazed, cv2.COLOR_BGR2LAB).astype(np.float64)
    orig_mean_l = np.mean(orig_lab[:, :, 0])
    dehaz_mean_l = np.mean(dehaz_lab[:, :, 0])
    if dehaz_mean_l < 1.0:
        return dehazed
    scale = orig_mean_l / dehaz_mean_l
    dehaz_lab[:, :, 0] = np.clip(dehaz_lab[:, :, 0] * scale, 0, 255)
    return cv2.cvtColor(dehaz_lab.astype(np.uint8), cv2.COLOR_LAB2BGR)


def gray_world_white_balance(image):
    img = image.astype(np.float64)
    mean_b = np.mean(img[:, :, 0])
    mean_g = np.mean(img[:, :, 1])
    mean_r = np.mean(img[:, :, 2])
    mean_all = (mean_b + mean_g + mean_r) / 3.0
    img[:, :, 0] *= mean_all / max(mean_b, 1e-6)
    img[:, :, 1] *= mean_all / max(mean_g, 1e-6)
    img[:, :, 2] *= mean_all / max(mean_r, 1e-6)
    return np.clip(img, 0, 255).astype(np.uint8)


def apply_gamma(image, gamma=0.9):
    if gamma == 1.0:
        return image
    img_float = image.astype(np.float64) / 255.0
    return (np.power(img_float, gamma) * 255).astype(np.uint8)


def apply_clahe(image, clip_limit=2.0, tile_grid_size=(8, 8)):
    lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=tile_grid_size)
    l_eq = clahe.apply(l)
    return cv2.cvtColor(cv2.merge([l_eq, a, b]), cv2.COLOR_LAB2BGR)

def apply_selective_clahe(
    image,
    transmission,
    clip_limit=3.0,
    tile_grid_size=(8, 8)
):
    """
    Apply CLAHE only to foggy regions using the refined
    transmission map from DCP.

    transmission:
        1.0 = clear
        0.0 = dense fog
    """

    # Build fog confidence map
    fog_mask = np.clip(
        (0.6 - transmission) / 0.6,
        0,
        1
    )

    # Emphasize dense fog regions
    fog_mask = np.power(fog_mask, 1.5)

    # Smooth transitions
    fog_mask = cv2.GaussianBlur(
        fog_mask,
        (21, 21),
        0
    )

    # CLAHE in LAB color space
    lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)

    l, a, b = cv2.split(lab)

    clahe = cv2.createCLAHE(
        clipLimit=clip_limit,
        tileGridSize=tile_grid_size
    )

    l_clahe = clahe.apply(l)

    clahe_img = cv2.cvtColor(
        cv2.merge([l_clahe, a, b]),
        cv2.COLOR_LAB2BGR
    )

    # Blend according to fog strength
    fog_mask = fog_mask[:, :, np.newaxis]

    result = (
        image.astype(np.float32) * (1.0 - fog_mask)
        +
        clahe_img.astype(np.float32) * fog_mask
    )

    return np.clip(result, 0, 255).astype(np.uint8)


def blend_with_original(original, dehazed, blend_ratio=0.75):
    orig_f = original.astype(np.float64)
    dehaz_f = dehazed.astype(np.float64)
    blended = blend_ratio * dehaz_f + (1.0 - blend_ratio) * orig_f
    return np.clip(blended, 0, 255).astype(np.uint8)


# ===========================================================================
# QUALITY METRICS — entropy, SSIM, mAP
# ===========================================================================
def compute_entropy(image):
    """Shannon entropy 0-8 bits."""
    if len(image.shape) == 3:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    else:
        gray = image
    hist = cv2.calcHist([gray], [0], None, [256], [0, 256]).flatten()
    p = hist[hist > 0] / hist.sum()
    return float(-np.sum(p * np.log2(p)))


def compute_ssim(img1, img2):
    """SSIM 0-1 between two BGR images."""
    C1 = (0.01 * 255) ** 2
    C2 = (0.03 * 255) ** 2
    if len(img1.shape) == 3:
        img1 = cv2.cvtColor(img1, cv2.COLOR_BGR2GRAY)
    if len(img2.shape) == 3:
        img2 = cv2.cvtColor(img2, cv2.COLOR_BGR2GRAY)
    img1 = img1.astype(np.float64)
    img2 = img2.astype(np.float64)
    kernel = cv2.getGaussianKernel(11, 1.5)
    window = np.outer(kernel, kernel.T)
    mu1 = cv2.filter2D(img1, -1, window)[5:-5, 5:-5]
    mu2 = cv2.filter2D(img2, -1, window)[5:-5, 5:-5]
    mu1_sq = mu1 ** 2
    mu2_sq = mu2 ** 2
    mu1_mu2 = mu1 * mu2
    sigma1_sq = cv2.filter2D(img1 ** 2, -1, window)[5:-5, 5:-5] - mu1_sq
    sigma2_sq = cv2.filter2D(img2 ** 2, -1, window)[5:-5, 5:-5] - mu2_sq
    sigma12 = cv2.filter2D(img1 * img2, -1, window)[5:-5, 5:-5] - mu1_mu2
    ssim_map = ((2 * mu1_mu2 + C1) * (2 * sigma12 + C2)) / \
               ((mu1_sq + mu2_sq + C1) * (sigma1_sq + sigma2_sq + C2))
    return float(ssim_map.mean())


# ---------------------------------------------------------------------------
# Object Detection mAP using HOG
# ---------------------------------------------------------------------------
# Initialize HOG once at module level (slow to construct repeatedly)
_HOG = cv2.HOGDescriptor()
_HOG.setSVMDetector(cv2.HOGDescriptor_getDefaultPeopleDetector())


def _compute_iou(box1, box2):
    """IoU of two boxes in (x, y, w, h) format."""
    x1, y1, w1, h1 = box1
    x2, y2, w2, h2 = box2
    ax1, ay1, ax2, ay2 = x1, y1, x1 + w1, y1 + h1
    bx1, by1, bx2, by2 = x2, y2, x2 + w2, y2 + h2
    ix1, iy1 = max(ax1, bx1), max(ay1, by1)
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    if ix2 <= ix1 or iy2 <= iy1:
        return 0.0
    intersection = (ix2 - ix1) * (iy2 - iy1)
    union = w1 * h1 + w2 * h2 - intersection
    return float(intersection / union) if union > 0 else 0.0


def _detect_people(image, max_dim=640):
    """
    Run HOG person detection on a downscaled image for speed.
    Returns: (boxes [N,4] in (x,y,w,h), weights [N] confidence scores)
             scaled back to original image dimensions.
    """
    h, w = image.shape[:2]
    scale = max_dim / max(h, w) if max(h, w) > max_dim else 1.0
    if scale < 1.0:
        small = cv2.resize(image, (int(w * scale), int(h * scale)))
    else:
        small = image

    try:
        boxes, weights = _HOG.detectMultiScale(
            small,
            winStride=(8, 8),
            padding=(8, 8),
            scale=1.05,
        )
    except cv2.error:
        return np.zeros((0, 4), dtype=int), np.zeros(0)

    if len(boxes) == 0:
        return np.zeros((0, 4), dtype=int), np.zeros(0)

    boxes = np.asarray(boxes)
    weights = np.asarray(weights).flatten()

    if scale < 1.0:
        boxes = (boxes / scale).astype(int)

    return boxes, weights


def compute_map(hazy_image, dehazed_image, iou_threshold=0.5):
    """
    Compute Object Detection mAP using HOG person detector.

    The dehazed image's detections are used as PROXY GROUND TRUTH (since the
    dehazed image has better visibility, its detections are more reliable).
    The hazy image's detections are evaluated against this proxy.

    Method:
      1. Run HOG detector on both images
      2. Sort hazy detections by confidence (descending)
      3. Greedy match each hazy detection to a dehazed detection (IoU >= 0.5)
      4. Build precision-recall curve
      5. Compute Average Precision via 11-point interpolation

    Range: [0, 1]
      • 1.0 = haze had no effect on detectability (ideal)
      • 0.0 = haze completely destroyed detectability OR no objects detected

    NOTE: HOG detects people only. For highway scenes without pedestrians,
    this metric will frequently return 0 (which is correct/honest behavior).

    Returns:
        float: mAP score in [0, 1]
    """
    hazy_boxes, hazy_weights = _detect_people(hazy_image)
    dehazed_boxes, dehazed_weights = _detect_people(dehazed_image)

    n_gt = len(dehazed_boxes)
    n_pred = len(hazy_boxes)

    # No proxy ground truth → mAP undefined → return 0
    if n_gt == 0:
        return 0.0
    # No predictions but ground truth exists → mAP = 0
    if n_pred == 0:
        return 0.0

    # Sort hazy detections by confidence (descending) for AP curve
    sorted_idx = np.argsort(hazy_weights)[::-1]
    hazy_boxes = hazy_boxes[sorted_idx]

    matched_gt = set()
    tp_list = []
    fp_list = []

    for pred_box in hazy_boxes:
        best_iou = 0.0
        best_gt = -1
        for j, gt_box in enumerate(dehazed_boxes):
            if j in matched_gt:
                continue
            iou = _compute_iou(pred_box, gt_box)
            if iou > best_iou:
                best_iou = iou
                best_gt = j
        if best_iou >= iou_threshold and best_gt >= 0:
            tp_list.append(1)
            fp_list.append(0)
            matched_gt.add(best_gt)
        else:
            tp_list.append(0)
            fp_list.append(1)

    tp_cum = np.cumsum(tp_list)
    fp_cum = np.cumsum(fp_list)

    recall = tp_cum / n_gt
    precision = tp_cum / np.maximum(tp_cum + fp_cum, 1e-9)

    # 11-point interpolated Average Precision (Pascal VOC standard)
    ap = 0.0
    for t in np.linspace(0, 1, 11):
        if np.any(recall >= t):
            ap += float(np.max(precision[recall >= t])) / 11.0

    return ap


def compute_metrics(hazy_image, dehazed_image):
    """
    Compute all quality metrics for a hazy/dehazed image pair.

    Returns dict with:
      - entropy_hazy: Shannon entropy of hazy image (0-8)
      - entropy_dehazed: Shannon entropy of dehazed image (0-8)
      - entropy_gain: dehazed - hazy
      - ssim: structural similarity (0-1)
      - map: object detection mAP using HOG person detector (0-1)
    """
    e_hazy = compute_entropy(hazy_image)
    e_dehazed = compute_entropy(dehazed_image)
    ssim_val = compute_ssim(hazy_image, dehazed_image)
    map_val = compute_map(hazy_image, dehazed_image)
    return {
        "entropy_hazy": round(e_hazy, 3),
        "entropy_dehazed": round(e_dehazed, 3),
        "entropy_gain": round(e_dehazed - e_hazy, 3),
        "ssim": round(ssim_val, 3),
        "map": round(map_val, 3),
    }


# ===========================================================================
# MODE PRESETS
# ===========================================================================
MODE_PRESETS = {
    "natural": {
        "omega": 0.85, "t0": 0.3, "max_A": 1.0, "gamma": 0.95,
        "use_clahe": True, "blend": 1.0,
        "match_lum": True, "white_balance": True,
    },
    "strong": {
        "omega": 0.95, "t0": 0.2, "max_A": 0.9, "gamma": 0.85,
        "use_clahe": True, "blend": 1.0,
        "match_lum": True, "white_balance": True,
    },
    "clahe": {
        "skip_dcp": True,
    },
}


# ===========================================================================
# MAIN PIPELINE
# ===========================================================================
def dehaze_image(
    hazy_image,
    mode="natural",
    omega=None, t0=None, max_A=None, gamma=None,
    blend=None, use_clahe=None,
    match_lum=None, white_balance=None,
    patch_size=15, guided_radius=80, guided_eps=1e-3,
):
    if mode not in MODE_PRESETS:
        raise ValueError(f"Unknown mode '{mode}'. Use: {list(MODE_PRESETS)}")

    preset = MODE_PRESETS[mode].copy()

    if preset.get("skip_dcp"):
        result = apply_clahe(hazy_image, clip_limit=3.0, tile_grid_size=(8, 8))
        result = gray_world_white_balance(result)
        return result

    p = {
        "omega": omega if omega is not None else preset["omega"],
        "t0": t0 if t0 is not None else preset["t0"],
        "max_A": max_A if max_A is not None else preset["max_A"],
        "gamma": gamma if gamma is not None else preset["gamma"],
        "blend": blend if blend is not None else preset["blend"],
        "use_clahe": use_clahe if use_clahe is not None else preset["use_clahe"],
        "match_lum": match_lum if match_lum is not None else preset["match_lum"],
        "white_balance": white_balance if white_balance is not None else preset["white_balance"],
    }

    image = hazy_image.astype(np.float64) / 255.0
    dark_channel = get_dark_channel(image, patch_size)
    A = estimate_atmospheric_light(image, dark_channel, max_A=p["max_A"])
    transmission = estimate_transmission(image, A, p["omega"], patch_size)
    gray = cv2.cvtColor(hazy_image, cv2.COLOR_BGR2GRAY).astype(np.float64) / 255.0
    transmission_refined = guided_filter(gray, transmission, guided_radius, guided_eps)
    print("Atmospheric Light:", A)

    print(
        "Transmission:",
        transmission_refined.min(),
        transmission_refined.mean(),
        transmission_refined.max()
        )
    transmission_refined = np.clip(
        transmission_refined,
        0.1,
        1.0)
    dehazed = recover_image(image, transmission_refined, A, p["t0"])
    dehazed = (dehazed * 255).astype(np.uint8)

    if p["match_lum"]:
        dehazed = match_luminance(hazy_image, dehazed)
    if p["white_balance"]:
        dehazed = gray_world_white_balance(dehazed)
    if p["use_clahe"]:
        dehazed = apply_selective_clahe(
        dehazed,
        transmission_refined,
        clip_limit=3.0,
        tile_grid_size=(8, 8)
    )

    if p["gamma"] != 1.0:
        dehazed = apply_gamma(
        dehazed,
        p["gamma"]
    )
    if p["blend"] < 1.0:
        dehazed = blend_with_original(hazy_image, dehazed, p["blend"])

    return dehazed


# ===========================================================================
# CLI
# ===========================================================================
def main():
    parser = argparse.ArgumentParser(description="DCP image dehazing v3.2")
    parser.add_argument("input", help="Path to foggy input image")
    parser.add_argument("--mode", choices=list(MODE_PRESETS), default="natural")
    parser.add_argument("--omega", type=float, default=None)
    parser.add_argument("--t0", type=float, default=None)
    parser.add_argument("--max-a", type=float, default=None)
    parser.add_argument("--gamma", type=float, default=None)
    parser.add_argument("--blend", type=float, default=None)
    parser.add_argument("--no-luminance-match", action="store_true")
    parser.add_argument("--no-white-balance", action="store_true")
    parser.add_argument("--no-clahe", action="store_true")
    args = parser.parse_args()

    if not os.path.exists(args.input):
        print(f"Error: file not found: {args.input}")
        sys.exit(1)

    print(f"Loading: {args.input}")
    hazy = cv2.imread(args.input)
    if hazy is None:
        print("Error: could not read image")
        sys.exit(1)
    print(f"Resolution: {hazy.shape[1]} x {hazy.shape[0]}")
    print(f"Mode: {args.mode}")

    start = time.time()
    dehazed = dehaze_image(
        hazy,
        mode=args.mode,
        omega=args.omega, t0=args.t0, max_A=args.max_a, gamma=args.gamma,
        blend=args.blend,
        match_lum=False if args.no_luminance_match else None,
        white_balance=False if args.no_white_balance else None,
        use_clahe=False if args.no_clahe else None,
    )
    elapsed = time.time() - start
    print(f"Dehazing done in {elapsed:.2f}s")

    print("\nQuality metrics:")
    metrics = compute_metrics(hazy, dehazed)
    for k, v in metrics.items():
        print(f"  {k:20s}: {v}")

    base, ext = os.path.splitext(args.input)
    out_path = f"{base}_dehazed_{args.mode}{ext}"
    cmp_path = f"{base}_comparison_{args.mode}{ext}"
    cv2.imwrite(out_path, dehazed)
    cv2.imwrite(cmp_path, np.hstack([hazy, dehazed]))
    print(f"\nSaved: {out_path}")
    print(f"Saved: {cmp_path}")


if __name__ == "__main__":
    main()
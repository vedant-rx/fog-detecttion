"""
dehaze.py (v4.0 — YOLOv8 Object Detection mAP)
===============================================
Dark Channel Prior (DCP) image dehazing with comprehensive fixes for
real-world highway fog images.

NEW IN v4.0:
  - compute_map(): Object detection mAP using YOLOv8n (COCO 80 classes).
    Detects people, cars, trucks, motorbikes, buses, etc.
    Treats dehazed image detections as proxy ground truth.
  - compute_metrics() now returns detected_hazy and detected_dehazed dicts
    with per-class object counts.

THREE MODES:
  natural  (default) - mild DCP + all fixes
  strong             - aggressive DCP for dense fog
  clahe              - just CLAHE, no DCP (best for daytime fog)

Usage:
    from dehaze import dehaze_image, compute_metrics
    clear = dehaze_image(hazy, mode="clahe")
    metrics = compute_metrics(hazy, clear)  # includes 'map', 'detected_hazy', 'detected_dehazed'

Dependencies:
    pip install opencv-python opencv-contrib-python numpy ultralytics
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


def estimate_atmospheric_light(
    image,
    dark_channel,
    top_percent=0.001,
    max_A=0.85
):
    h, w = dark_channel.shape
    num_pixels = h * w
    num_top = max(int(num_pixels * top_percent), 1)

    dark_flat = dark_channel.flatten()
    image_flat = image.reshape(num_pixels, 3)

    # Candidate pixels from dark channel
    indices = np.argpartition(
        dark_flat,
        -num_top
    )[-num_top:]

    candidates = image_flat[indices]

    # Remove extremely bright pixels
    brightness = np.max(candidates, axis=1)

    valid = brightness < 0.90

    if np.sum(valid) > 10:
        candidates = candidates[valid]

    A = np.mean(candidates, axis=0)

    print("Atmospheric Light:", A)

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
# Detection Annotation Renderer
# ---------------------------------------------------------------------------

# Per-class BGR colours for bounding boxes
_CLASS_COLORS_BGR = {
    "person":     (  0, 220,  80),   # green
    "car":        ( 60, 180, 255),   # sky blue
    "truck":      (  0, 140, 255),   # orange
    "bus":        (180,  60, 255),   # purple
    "motorcycle": (255,  60, 200),   # pink
    "bicycle":    (255, 220,  40),   # yellow
}
_DEFAULT_COLOR_BGR = (200, 200, 200)


def draw_detections(image, boxes, scores, class_ids, highway_classes):
    """
    Draw bounding boxes + filled-label annotations onto a copy of *image*.

    Args:
        image        : BGR uint8 numpy array (not modified in place)
        boxes        : [N, 4] xyxy float array
        scores       : [N]    confidence float array
        class_ids    : [N]    int COCO class IDs
        highway_classes: dict {id: name}  (e.g. _HIGHWAY_CLASSES)

    Returns:
        annotated BGR uint8 numpy array
    """
    out = image.copy()
    font       = cv2.FONT_HERSHEY_SIMPLEX
    font_scale = 0.55
    thickness  = 2
    pad        = 4

    for box, score, cid in zip(boxes, scores, class_ids):
        name  = highway_classes.get(int(cid), str(cid))
        color = _CLASS_COLORS_BGR.get(name, _DEFAULT_COLOR_BGR)

        x1, y1, x2, y2 = map(int, box)

        # Bounding box
        cv2.rectangle(out, (x1, y1), (x2, y2), color, thickness)

        # Clean, sharp label text inside the box (font_scale=0.45, thickness=1)
        font_scale_lbl = 0.42
        thickness_lbl  = 1
        label = f"{name} {score:.2f}"
        (tw, th), baseline = cv2.getTextSize(label, font, font_scale_lbl, thickness_lbl)

        # Position label inside box at the top-left corner
        # If box is too small in height, fall back to drawing just above it
        box_h = y2 - y1
        if box_h > (th + baseline + pad * 2):
            label_y1 = y1
            label_y2 = y1 + th + baseline + pad * 2
            text_y = label_y2 - baseline - pad
        else:
            label_y1 = max(y1 - th - baseline - pad * 2, 0)
            label_y2 = label_y1 + th + baseline + pad * 2
            text_y = label_y2 - baseline - pad

        # Filled label background (only width of the text)
        cv2.rectangle(out, (x1, label_y1), (min(x1 + tw + pad * 2, x2), label_y2), color, -1)

        # White text on color background
        cv2.putText(
            out, label,
            (x1 + pad, text_y),
            font, font_scale_lbl, (255, 255, 255), thickness_lbl, cv2.LINE_AA,
        )

    return out


# ---------------------------------------------------------------------------
# Object Detection mAP using YOLOv8n
# ---------------------------------------------------------------------------

# Highway-relevant COCO class IDs
_HIGHWAY_CLASSES = {
    0: "person",
    1: "bicycle",
    2: "car",
    3: "motorcycle",
    5: "bus",
    7: "truck",
}

# YOLOv8 model — loaded lazily on first use
_YOLO_MODEL = None


def _get_yolo():
    """Lazy-load YOLOv8n once (downloads ~6MB on first call)."""
    global _YOLO_MODEL
    if _YOLO_MODEL is None:
        try:
            from ultralytics import YOLO
            _YOLO_MODEL = YOLO("yolov8n.pt")
            print("[YOLO] YOLOv8n loaded successfully.")
        except Exception as e:
            print(f"[YOLO] Failed to load YOLOv8n: {e}")
            _YOLO_MODEL = False  # Sentinel: don't try again
    return _YOLO_MODEL if _YOLO_MODEL else None


def _compute_iou_xyxy(box1, box2):
    """IoU of two boxes in (x1, y1, x2, y2) format."""
    ix1 = max(box1[0], box2[0])
    iy1 = max(box1[1], box2[1])
    ix2 = min(box1[2], box2[2])
    iy2 = min(box1[3], box2[3])
    if ix2 <= ix1 or iy2 <= iy1:
        return 0.0
    inter = (ix2 - ix1) * (iy2 - iy1)
    area1 = (box1[2] - box1[0]) * (box1[3] - box1[1])
    area2 = (box2[2] - box2[0]) * (box2[3] - box2[1])
    union = area1 + area2 - inter
    return float(inter / union) if union > 0 else 0.0


def _detect_objects(image, conf=0.10):
    """
    Run YOLOv8n inference on an image (BGR numpy array).

    Args:
        image: BGR uint8 numpy array
        conf:  Base confidence floor passed to YOLO (0.10).
               Per-class thresholds are applied afterwards — see below.
               Setting this lower than the per-class thresholds ensures YOLO
               surfaces all candidate boxes before we prune them ourselves.

    Returns:
        boxes     : np.ndarray [N, 4] — (x1, y1, x2, y2) in pixels
        scores    : np.ndarray [N]    — confidence 0-1
        class_ids : np.ndarray [N]    — COCO class IDs

    Returns three empty arrays if YOLO is unavailable.
    """
    model = _get_yolo()
    if model is None:
        return (
            np.zeros((0, 4), dtype=np.float32),
            np.zeros(0, dtype=np.float32),
            np.zeros(0, dtype=int),
        )

    # Convert BGR → RGB for ultralytics
    rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

    results = model(
        rgb,
        conf=conf,
        iou=0.45,                          # NMS threshold — suppress overlapping duplicate boxes
        classes=list(_HIGHWAY_CLASSES.keys()),
        verbose=False,
    )

    boxes_list, scores_list, cls_list = [], [], []
    for r in results:
        if r.boxes is None or len(r.boxes) == 0:
            continue
        boxes_list.append(r.boxes.xyxy.cpu().numpy())   # [K, 4]
        scores_list.append(r.boxes.conf.cpu().numpy())  # [K]
        cls_list.append(r.boxes.cls.cpu().numpy().astype(int))  # [K]

    if not boxes_list:
        return (
            np.zeros((0, 4), dtype=np.float32),
            np.zeros(0, dtype=np.float32),
            np.zeros(0, dtype=int),
        )

    all_boxes  = np.concatenate(boxes_list, axis=0)
    all_scores = np.concatenate(scores_list, axis=0)
    all_cls    = np.concatenate(cls_list, axis=0)

    # --- 1. Minimum box area filter ----------------------------------------
    # Discard tiny detections (road signs, barrier posts, distant clutter).
    img_area = image.shape[0] * image.shape[1]
    min_area = 0.0025 * img_area   # 0.25% of image
    box_areas = (all_boxes[:, 2] - all_boxes[:, 0]) * (all_boxes[:, 3] - all_boxes[:, 1])
    keep = box_areas >= min_area
    all_boxes  = all_boxes[keep]
    all_scores = all_scores[keep]
    all_cls    = all_cls[keep]

    # --- 2. Per-class confidence thresholds --------------------------------
    # Filter out weak detections early before NMS. This avoids incorrect high-conf
    # classes (like a truck at 0.36) from shadowing and deleting the correct class
    # (like a car at 0.23) during NMS.
    _CLASS_CONF_THRESHOLDS = {
        "car":        0.12,
        "person":     0.20,
        "bicycle":    0.20,
        "motorcycle": 0.20,
        "truck":      0.35,   # optimized to allow real trucks/SUVs
        "bus":        0.35,   # optimized to allow real buses
    }
    per_class_keep = np.array([
        all_scores[i] >= _CLASS_CONF_THRESHOLDS.get(
            _HIGHWAY_CLASSES.get(int(all_cls[i]), ""), 0.20
        )
        for i in range(len(all_cls))
    ], dtype=bool)

    all_boxes  = all_boxes[per_class_keep]
    all_scores = all_scores[per_class_keep]
    all_cls    = all_cls[per_class_keep]

    if len(all_boxes) == 0:
        return (
            np.zeros((0, 4), dtype=np.float32),
            np.zeros(0, dtype=np.float32),
            np.zeros(0, dtype=int),
        )

    # --- 3. Sort descending by score --------------------------------------
    sort_idxs  = np.argsort(all_scores)[::-1]
    all_boxes  = all_boxes[sort_idxs]
    all_scores = all_scores[sort_idxs]
    all_cls    = all_cls[sort_idxs]

    # --- 4. Class-agnostic Non-Maximum Suppression (NMS) -------------------
    # Suppress duplicate overlapping boxes of different classes
    keep_indices = []
    for i in range(len(all_boxes)):
        discard = False
        for j in keep_indices:
            iou = _compute_iou_xyxy(all_boxes[i], all_boxes[j])
            if iou >= 0.40:
                discard = True
                break
        if not discard:
            keep_indices.append(i)

    return (
        all_boxes[keep_indices],
        all_scores[keep_indices],
        all_cls[keep_indices],
    )


def _count_objects(class_ids):
    """
    Returns a dict mapping human-readable class names to detection counts.
    Only highway-relevant classes are included.
    """
    counts = {}
    for cid in class_ids:
        name = _HIGHWAY_CLASSES.get(int(cid))
        if name:
            counts[name] = counts.get(name, 0) + 1
    return counts


def _compute_ap_for_class(
    pred_boxes, pred_scores, gt_boxes, iou_threshold=0.5
):
    """
    Compute Average Precision for a single class using 11-point interpolation.

    pred_boxes  : [N, 4] xyxy
    pred_scores : [N]    confidence
    gt_boxes    : [M, 4] xyxy
    """
    n_gt = len(gt_boxes)
    n_pred = len(pred_boxes)

    if n_gt == 0:
        return None   # Class not in ground truth — skip
    if n_pred == 0:
        return 0.0    # Missed all ground truth

    # Sort by confidence descending
    order = np.argsort(pred_scores)[::-1]
    pred_boxes = pred_boxes[order]

    matched_gt = set()
    tp_list, fp_list = [], []

    for pb in pred_boxes:
        best_iou, best_j = 0.0, -1
        for j, gb in enumerate(gt_boxes):
            if j in matched_gt:
                continue
            iou = _compute_iou_xyxy(pb, gb)
            if iou > best_iou:
                best_iou, best_j = iou, j
        if best_iou >= iou_threshold and best_j >= 0:
            tp_list.append(1)
            fp_list.append(0)
            matched_gt.add(best_j)
        else:
            tp_list.append(0)
            fp_list.append(1)

    tp_cum = np.cumsum(tp_list)
    fp_cum = np.cumsum(fp_list)
    recall    = tp_cum / n_gt
    precision = tp_cum / np.maximum(tp_cum + fp_cum, 1e-9)

    ap = 0.0
    for t in np.linspace(0, 1, 11):
        mask = recall >= t
        if np.any(mask):
            ap += float(np.max(precision[mask])) / 11.0
    return ap


def compute_map(hazy_image, dehazed_image, iou_threshold=0.5):
    """
    Compute multi-class Object Detection mAP using YOLOv8n.

    Strategy:
      - Run YOLOv8n on the dehazed image → proxy ground truth
        (dehazed image has better visibility, its detections are more reliable)
      - Run YOLOv8n on the hazy image → predictions to evaluate
      - For each highway class found in GT, compute AP@0.5
      - Average APs → mAP

    Detects: person, bicycle, car, motorcycle, bus, truck

    Range: [0, 1]
      • 1.0 = fog had zero impact on object detectability
      • 0.0 = fog completely destroyed detectability

    Returns:
        tuple: (map_score: float, detected_hazy: dict, detected_dehazed: dict)
    """
    hazy_boxes,    hazy_scores,    hazy_cls    = _detect_objects(hazy_image)
    dehazed_boxes, dehazed_scores, dehazed_cls = _detect_objects(dehazed_image)

    det_hazy    = _count_objects(hazy_cls)
    det_dehazed = _count_objects(dehazed_cls)

    print(f"[YOLO] Hazy detections   : {det_hazy}")
    print(f"[YOLO] Dehazed detections: {det_dehazed}")

    # Classes present in ground truth (dehazed detections)
    gt_classes = np.unique(dehazed_cls) if len(dehazed_cls) > 0 else []

    if len(gt_classes) == 0:
        # Nothing detected even in the clear image — mAP undefined
        return 0.0, det_hazy, det_dehazed

    ap_scores = []
    for cls_id in gt_classes:
        # Ground truth boxes for this class
        gt_mask  = dehazed_cls == cls_id
        gt_b     = dehazed_boxes[gt_mask]

        # Prediction boxes for this class
        pred_mask = hazy_cls == cls_id
        pred_b    = hazy_boxes[pred_mask]
        pred_s    = hazy_scores[pred_mask]

        ap = _compute_ap_for_class(pred_b, pred_s, gt_b, iou_threshold)
        if ap is not None:
            ap_scores.append(ap)

    map_score = float(np.mean(ap_scores)) if ap_scores else 0.0
    return round(map_score, 3), det_hazy, det_dehazed


def compute_metrics(hazy_image, dehazed_image):
    """
    Compute all quality metrics for a hazy/dehazed image pair.

    Returns dict with:
      - entropy_hazy     : Shannon entropy of hazy image (0-8)
      - entropy_dehazed  : Shannon entropy of dehazed image (0-8)
      - entropy_gain     : dehazed - hazy
      - ssim             : structural similarity (0-1)
      - map              : YOLOv8 multi-class mAP@0.5 (0-1)
      - detected_hazy    : {class_name: count} in original foggy image
      - detected_dehazed : {class_name: count} in dehazed image
    """
    e_hazy    = compute_entropy(hazy_image)
    e_dehazed = compute_entropy(dehazed_image)
    ssim_val  = compute_ssim(hazy_image, dehazed_image)
    map_val, det_hazy, det_dehazed = compute_map(hazy_image, dehazed_image)
    return {
        "entropy_hazy"     : round(e_hazy, 3),
        "entropy_dehazed"  : round(e_dehazed, 3),
        "entropy_gain"     : round(e_dehazed - e_hazy, 3),
        "ssim"             : round(ssim_val, 3),
        "map"              : map_val,
        "detected_hazy"    : det_hazy,
        "detected_dehazed" : det_dehazed,
    }


# ===========================================================================
# MODE PRESETS
# ===========================================================================
MODE_PRESETS = {
    "natural": {
        "omega": 0.75, "t0": 0.45, "max_A": 1.0, "gamma": 0.95,
        "use_clahe": True, "blend": 1.0,
        "match_lum": False, "white_balance": False,
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
        result = apply_clahe(
            hazy_image,
            clip_limit=3.0,
            tile_grid_size=(8, 8)
        )
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

    # -------------------------------------------------
    # DCP CORE
    # -------------------------------------------------

    image = hazy_image.astype(np.float64) / 255.0

    dark_channel = get_dark_channel(
        image,
        patch_size
    )

    A = estimate_atmospheric_light(
        image,
        dark_channel,
        max_A=p["max_A"]
    )

    transmission = estimate_transmission(
        image,
        A,
        p["omega"],
        patch_size
    )

    gray = cv2.cvtColor(
        hazy_image,
        cv2.COLOR_BGR2GRAY
    ).astype(np.float64) / 255.0

    transmission_refined = guided_filter(
        gray,
        transmission,
        guided_radius,
        guided_eps
    )

    print("Atmospheric Light:", A)

    print(
        "Transmission:",
        transmission_refined.min(),
        transmission_refined.mean(),
        transmission_refined.max()
    )

    # -------------------------------------------------
    # HEADLIGHT PROTECTION
    # -------------------------------------------------

    gray_lights = cv2.cvtColor(
        hazy_image,
        cv2.COLOR_BGR2GRAY
    ).astype(np.float32)

    light_mask = np.clip(
        (gray_lights - 200) / 55,
        0,
        1
    )

    transmission_refined = np.maximum(
        transmission_refined,
        0.7 * light_mask +
        transmission_refined * (1 - light_mask)
    )

    # -------------------------------------------------

    transmission_refined = np.clip(
        transmission_refined,
        0.1,
        1.0
    )

    dehazed = recover_image(
        image,
        transmission_refined,
        A,
        p["t0"]
    )

    dehazed = (dehazed * 255).astype(np.uint8)

    # -------------------------------------------------
    # POST PROCESSING
    # -------------------------------------------------

    if p["match_lum"]:
        dehazed = match_luminance(
            hazy_image,
            dehazed
        )

    if p["white_balance"]:
        dehazed = gray_world_white_balance(
            dehazed
        )

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
        dehazed = blend_with_original(
            hazy_image,
            dehazed,
            p["blend"]
        )

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
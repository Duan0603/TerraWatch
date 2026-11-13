# Existing training equations, self-contained for cached research inputs.

import hashlib

import random

from pathlib import Path

import numpy as np

import pandas as pd

import torch

from torch import nn

FIELDS = ['slope_deg', 'elevation_m', 'clay_pct', 'sand_pct', 'bulk_density_g_cm3']

RAIN_COLUMNS = ['rain_h001', 'rain_h002', 'rain_h003', 'rain_h004', 'rain_h005', 'rain_h006', 'rain_h007', 'rain_h008', 'rain_h009', 'rain_h010', 'rain_h011', 'rain_h012', 'rain_h013', 'rain_h014', 'rain_h015', 'rain_h016', 'rain_h017', 'rain_h018', 'rain_h019', 'rain_h020', 'rain_h021', 'rain_h022', 'rain_h023', 'rain_h024', 'rain_h025', 'rain_h026', 'rain_h027', 'rain_h028', 'rain_h029', 'rain_h030', 'rain_h031', 'rain_h032', 'rain_h033', 'rain_h034', 'rain_h035', 'rain_h036', 'rain_h037', 'rain_h038', 'rain_h039', 'rain_h040', 'rain_h041', 'rain_h042', 'rain_h043', 'rain_h044', 'rain_h045', 'rain_h046', 'rain_h047', 'rain_h048', 'rain_h049', 'rain_h050', 'rain_h051', 'rain_h052', 'rain_h053', 'rain_h054', 'rain_h055', 'rain_h056', 'rain_h057', 'rain_h058', 'rain_h059', 'rain_h060', 'rain_h061', 'rain_h062', 'rain_h063', 'rain_h064', 'rain_h065', 'rain_h066', 'rain_h067', 'rain_h068', 'rain_h069', 'rain_h070', 'rain_h071', 'rain_h072', 'rain_h073', 'rain_h074', 'rain_h075', 'rain_h076', 'rain_h077', 'rain_h078', 'rain_h079', 'rain_h080', 'rain_h081', 'rain_h082', 'rain_h083', 'rain_h084', 'rain_h085', 'rain_h086', 'rain_h087', 'rain_h088', 'rain_h089', 'rain_h090', 'rain_h091', 'rain_h092', 'rain_h093', 'rain_h094', 'rain_h095', 'rain_h096', 'rain_h097', 'rain_h098', 'rain_h099', 'rain_h100', 'rain_h101', 'rain_h102', 'rain_h103', 'rain_h104', 'rain_h105', 'rain_h106', 'rain_h107', 'rain_h108', 'rain_h109', 'rain_h110', 'rain_h111', 'rain_h112', 'rain_h113', 'rain_h114', 'rain_h115', 'rain_h116', 'rain_h117', 'rain_h118', 'rain_h119', 'rain_h120', 'rain_h121', 'rain_h122', 'rain_h123', 'rain_h124', 'rain_h125', 'rain_h126', 'rain_h127', 'rain_h128', 'rain_h129', 'rain_h130', 'rain_h131', 'rain_h132', 'rain_h133', 'rain_h134', 'rain_h135', 'rain_h136', 'rain_h137', 'rain_h138', 'rain_h139', 'rain_h140', 'rain_h141', 'rain_h142', 'rain_h143', 'rain_h144', 'rain_h145', 'rain_h146', 'rain_h147', 'rain_h148', 'rain_h149', 'rain_h150', 'rain_h151', 'rain_h152', 'rain_h153', 'rain_h154', 'rain_h155', 'rain_h156', 'rain_h157', 'rain_h158', 'rain_h159', 'rain_h160', 'rain_h161', 'rain_h162', 'rain_h163', 'rain_h164', 'rain_h165', 'rain_h166', 'rain_h167', 'rain_h168']

def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()

def sample_id_for(unit_id: str, day: str) -> str:
    return 'next24h_' + hashlib.sha256(f'{unit_id}|{day}'.encode()).hexdigest()[:20]

def sigmoid(z: np.ndarray) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-np.clip(z, -40.0, 40.0)))

def fit_l2_logistic(X: np.ndarray, y: np.ndarray, l2: float = 1.0, steps: int = 400) -> tuple[np.ndarray, float]:
    """Deterministic Newton-IRLS L2 logistic regression with class-balanced weights."""
    n, d = X.shape
    pos = max(int((y == 1).sum()), 1)
    neg = max(int((y == 0).sum()), 1)
    sample_w = np.where(y == 1, n / (2.0 * pos), n / (2.0 * neg))
    Xb = np.column_stack([np.ones(n), X])
    theta = np.zeros(d + 1, dtype=np.float64)
    reg = np.diag([0.0] + [l2] * d)
    for _ in range(steps):
        p = sigmoid(Xb @ theta)
        grad = Xb.T @ (sample_w * (p - y)) + reg @ theta
        w = np.maximum(sample_w * p * (1.0 - p), 1e-6)
        hess = (Xb.T * w) @ Xb + reg
        delta = np.linalg.solve(hess, grad)
        theta -= delta
        if np.max(np.abs(delta)) < 1e-7:
            break
    return theta[1:], float(theta[0])

def binary_metrics(y_true: np.ndarray, probs: np.ndarray, threshold: float) -> dict:
    preds = (probs >= threshold).astype(int)
    tp = int(((preds == 1) & (y_true == 1)).sum())
    fp = int(((preds == 1) & (y_true == 0)).sum())
    tn = int(((preds == 0) & (y_true == 0)).sum())
    fn = int(((preds == 0) & (y_true == 1)).sum())
    prec = tp / (tp + fp) if (tp + fp) else 0.0
    rec = tp / (tp + fn) if (tp + fn) else 0.0
    f1 = 2 * prec * rec / (prec + rec) if (prec + rec) else 0.0
    pos_rate = float(preds.mean()) if len(preds) else 0.0
    # Exact Mann-Whitney ROC-AUC and step PR-AUC
    order = np.argsort(-probs, kind='mergesort')
    y_sorted = y_true[order]
    n_pos = int((y_true == 1).sum())
    n_neg = int((y_true == 0).sum())
    if n_pos > 0 and n_neg > 0:
        ranks = np.argsort(np.argsort(probs, kind='mergesort')) + 1
        auc_roc = float((ranks[y_true == 1].sum() - n_pos * (n_pos + 1) / 2.0) / (n_pos * n_neg))
        cum_tp = np.cumsum(y_sorted == 1)
        cum_fp = np.cumsum(y_sorted == 0)
        precisions = cum_tp / (cum_tp + cum_fp)
        recalls = cum_tp / n_pos
        pr_auc = float(np.sum(precisions[y_sorted == 1]) / n_pos)
    else:
        auc_roc, pr_auc = 0.0, 0.0
    return {
        'rows': int(len(y_true)),
        'positives': n_pos,
        'negatives': n_neg,
        'threshold': float(threshold),
        'tp': tp,
        'fp': fp,
        'tn': tn,
        'fn': fn,
        'precision': round(prec, 4),
        'recall': round(rec, 4),
        'f1': round(f1, 4),
        'roc_auc': round(auc_roc, 4),
        'pr_auc': round(pr_auc, 4),
        'predicted_positive_rate': round(pos_rate, 4),
    }

def set_seed(seed: int = 42):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)

class TemporalTriggerGRU(nn.Module):
    """168-hour rainfall sequence GRU + 24h GFS & summary context head."""

    def __init__(self, step_dim: int = 7, hidden_dim: int = 24, summary_dim: int = 5):
        super().__init__()
        self.gru = nn.GRU(
            input_size=step_dim,
            hidden_size=hidden_dim,
            num_layers=1,
            batch_first=True,
        )
        self.head = nn.Sequential(
            nn.Linear(hidden_dim + summary_dim, 16),
            nn.ReLU(),
            nn.Linear(16, 1),
        )

    def forward(self, seq_x: torch.Tensor, sum_x: torch.Tensor) -> torch.Tensor:
        # seq_x: (N, 24, 7) representing 24 blocks of 7 hours = 168 hours in chronological order
        _, h_n = self.gru(seq_x)
        h = h_n[-1]
        combined = torch.cat([h, sum_x], dim=-1)
        logits = self.head(combined).squeeze(-1)
        return logits

def build_summary_rain_matrix(df: pd.DataFrame) -> np.ndarray:
    rain_arr = df[RAIN_COLUMNS].to_numpy(dtype=np.float64)
    r24 = rain_arr[:, -24:].sum(axis=1)
    r72 = rain_arr[:, -72:].sum(axis=1)
    r168 = rain_arr.sum(axis=1)
    rpeak = rain_arr.max(axis=1)
    gfs = df['forecast_24h_mm'].to_numpy(dtype=np.float64)
    return np.log1p(np.maximum(np.column_stack([r24, r72, r168, rpeak, gfs]), 0.0))

def build_sequence_rain_tensor(df: pd.DataFrame) -> np.ndarray:
    rain_arr = df[RAIN_COLUMNS].to_numpy(dtype=np.float64)
    seq_log = np.log1p(np.maximum(rain_arr, 0.0))
    # Reshape (N, 168) -> (N, 24, 7)
    return seq_log.reshape(len(df), 24, 7)

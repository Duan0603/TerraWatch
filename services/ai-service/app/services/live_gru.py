"""Exact trained GRU equations on CPU with exported, hash-checked weights."""
import hashlib
import json
from pathlib import Path

import numpy as np


def sigmoid(x):
    return 1.0 / (1.0 + np.exp(-np.clip(x, -80, 80)))


class LiveGRU:
    def __init__(self, directory=None):
        directory = Path(directory) if directory else Path(__file__).resolve().parents[2] / 'models/gru_live'
        self.card = json.loads((directory / 'model.json').read_text(encoding='utf8'))
        weights = directory / 'weights.npz'
        if hashlib.sha256(weights.read_bytes()).hexdigest() != self.card['weights_sha256']:
            raise ValueError('GRU weight integrity check failed')
        with np.load(weights, allow_pickle=False) as saved:
            self.weights = {k: saved[k].copy() for k in saved.files}
        if not all(np.isfinite(v).all() for v in self.weights.values()):
            raise ValueError('Nonfinite GRU weights')

    def predict(self, history, forecast, static):
        rain = np.asarray(history, dtype=np.float64).reshape(1, -1)
        if rain.shape != (1, 168) or not np.isfinite(rain).all() or (rain < 0).any():
            raise ValueError('Expected exactly 168 finite, nonnegative rainfall hours')
        if not np.isfinite(forecast) or forecast < 0:
            raise ValueError('Invalid 24h precipitation forecast')
        seq = np.log1p(rain).reshape(1, 24, 7)
        summary = np.log1p(np.array([[rain[:, -24:].sum(), rain[:, -72:].sum(), rain.sum(), rain.max(), forecast]]))
        for array, name in [(seq, 'seq_norm_b'), (summary, 'sum_norm_b')]:
            norm = self.card[name]
            array -= np.asarray(norm['mean'])
            array /= np.asarray(norm['std'])
        seq, summary = seq.astype(np.float32), summary.astype(np.float32)
        w = self.weights
        h = np.zeros((1, 24), dtype=np.float32)
        for step in range(24):
            gi = seq[:, step] @ w['gru.weight_ih_l0'].T + w['gru.bias_ih_l0']
            gh = h @ w['gru.weight_hh_l0'].T + w['gru.bias_hh_l0']
            r = sigmoid(gi[:, :24] + gh[:, :24])
            z = sigmoid(gi[:, 24:48] + gh[:, 24:48])
            candidate = np.tanh(gi[:, 48:] + r * gh[:, 48:])
            h = (1-z)*candidate + z*h
        dense = np.maximum(np.concatenate([h, summary], axis=1) @ w['head.0.weight'].T + w['head.0.bias'], 0)
        temporal = float(sigmoid(dense @ w['head.2.weight'].T + w['head.2.bias'])[0, 0])
        spatial = self.card['spatial_12dist_slope_soil']
        values = np.asarray([static[f] for f in spatial['features']], dtype=np.float64)
        if not np.isfinite(values).all():
            raise ValueError('Missing/nonfinite terrain or soil')
        normalized = (values-np.asarray(spatial['mean']))/np.asarray(spatial['std'])
        spatial_score = float(sigmoid(normalized @ np.array([spatial['weights'][f] for f in spatial['features']]) + spatial['bias']))
        return {'temporal_score': temporal, 'spatial_score': spatial_score,
                'hazard_score': temporal*spatial_score, 'model_id': self.card['model_id'],
                'checkpoint_sha256': self.card['source_checkpoint_sha256'],
                'calibrated_probability': False, 'operational_alert': False}

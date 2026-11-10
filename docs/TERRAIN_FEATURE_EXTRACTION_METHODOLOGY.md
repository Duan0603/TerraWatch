# TerraWatch DEM Terrain Feature Extraction Methodology

## 1. Overview & Scope (Story 2.2)

This specification defines the digital elevation model (DEM) feature extraction algorithms and data contracts used by **GIS Service** (`services/gis-service`) to supply geomorphic baseline metrics to the AI hazard forecasting service and WebGIS dashboard.

---

## 2. Geodesic Metric Conversion

Elevation matrices are ingested in geographic coordinates (`EPSG:4326`, WGS84). To prevent distortion when computing gradient and slope across Vietnam's latitudes ($8.5^\circ\text{N}$ to $23.5^\circ\text{N}$), angular degrees must be converted to metric distances:

$$dy = \Delta \text{lat} \times 111{,}132\text{ m}$$

$$dx = \Delta \text{lon} \times 111{,}413 \times \cos(\text{lat}_\text{center}) - 94 \times \cos(3 \times \text{lat}_\text{center})\text{ m}$$

At latitude $22.5^\circ\text{N}$ (Lào Cai / Sa Pa pilot AOI):
- $1^\circ \text{ latitude} \approx 110.74\text{ km}$
- $1^\circ \text{ longitude} \approx 102.83\text{ km}$
- $0.00027^\circ \text{ grid step} \approx 29.9\text{ m} \times 27.8\text{ m}$ (~30m Copernicus GLO-30 resolution).

---

## 3. Terrain Metrics Computation

For each spatial assessment unit $U_i \in \text{gis\_schema.spatial\_assessment\_units}$:

1. **Elevation Statistics:**
   - $\text{elevation\_avg} = \frac{1}{|K|} \sum_{p \in K} z(p)$
   - $\text{relief\_m} = \max_{p \in K}(z(p)) - \min_{p \in K}(z(p))$
   where $K$ excludes nodata values ($\{-9999, -32768, \text{NaN}\}$).

2. **Slope Calculation (Finite Difference Gradient):**
   For cell $(r, c)$ with horizontal resolution $dx$ and vertical resolution $dy$:
   $$\frac{\partial z}{\partial x} = \frac{z(r, c+1) - z(r, c-1)}{2 \cdot dx}, \quad \frac{\partial z}{\partial y} = \frac{z(r+1, c) - z(r-1, c)}{2 \cdot dy}$$
   $$\text{slope} = \arctan\left(\sqrt{\left(\frac{\partial z}{\partial x}\right)^2 + \left(\frac{\partial z}{\partial y}\right)^2}\right) \times \frac{180^\circ}{\pi}$$

3. **Hazard Risk Thresholds:**
   - $\ge 35^\circ$: **CRITICAL / EXTREME** (High-angle taluy cut slopes prone to failure).
   - $25^\circ - 34.9^\circ$: **HIGH** (Steep mountainous terrain).
   - $15^\circ - 24.9^\circ$: **MODERATE** (Hilly undulating slopes).
   - $< 15^\circ$: **LOW / SAFE** (Valley floors and alluvial plains).

---

## 4. Verification & Automated Testing

The pipeline is verified via automated test suites:
- Python GIS Engine: `python -m unittest services/gis-service/tests/test_terrain.py`
- Synthetic Benchmarks: `python -m unittest services/gis-service/tests/test_terrain_benchmarks.py`
- WebGIS Contracts: `node apps/webgis/tests/run-all-tests.mjs`

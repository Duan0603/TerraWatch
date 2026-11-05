import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

export async function simulateRainfall({ scenario, terrain, seed }) {
  const res = await axios.post(`${API_BASE}/api/v1/ai/simulate/rainfall`, {
    scenario, terrain, ...(seed != null && { seed }),
  }, { timeout: 15000 });
  return res.data;
}

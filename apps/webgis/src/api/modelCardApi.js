import axiosClient from './axiosClient';

// Story 4.29: the model cards as the AI service reports them (officer and admin only).
export async function getModelCard() {
  return axiosClient.get('/model-card'); // axiosClient already returns response.data
}

export default { getModelCard };

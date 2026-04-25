import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const BASE_URL = `${BACKEND_URL}/api`;

const api = axios.create({ baseURL: BASE_URL, timeout: 15000, withCredentials: true });

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('atlas_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      await AsyncStorage.removeItem('atlas_token');
      await AsyncStorage.removeItem('atlas_user');
    }
    return Promise.reject(err);
  }
);

export default api;

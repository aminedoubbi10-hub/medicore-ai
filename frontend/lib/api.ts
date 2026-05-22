import axios, { AxiosInstance, AxiosError } from 'axios';
import Cookies from 'js-cookie';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

const api: AxiosInstance = axios.create({
  baseURL: BASE,
  timeout: 60_000,
  headers: { 'Content-Type': 'application/json' },
});

const COOKIE_OPTS = {
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
};

api.interceptors.request.use((config) => {
  const token = Cookies.get('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const orig = error.config as any;
    if (error.response?.status === 401 && !orig._retry) {
      orig._retry = true;
      try {
        const rt = Cookies.get('refresh_token');
        if (!rt) throw new Error('No refresh token');
        const { data } = await axios.post(`${BASE}/auth/refresh`, { refresh_token: rt });
        Cookies.set('access_token', data.access_token, COOKIE_OPTS);
        orig.headers.Authorization = `Bearer ${data.access_token}`;
        return api(orig);
      } catch {
        Cookies.remove('access_token');
        Cookies.remove('refresh_token');
        if (typeof window !== 'undefined') window.location.href = '/login';
      }
    }
    const msg = (error.response?.data as any)?.detail || error.message || 'Unexpected error';
    return Promise.reject(new Error(msg));
  }
);

export const authAPI = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }).then((r) => r.data),
  register: (data: any) => api.post('/auth/register', data).then((r) => r.data),
  refresh: (refresh_token: string) =>
    api.post('/auth/refresh', { refresh_token }).then((r) => r.data),
};

export const ecgAPI = {
  upload: (form: FormData) =>
    api.post('/ecg/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data),
  getResult: (id: string) => api.get(`/ecg/${id}/result`).then((r) => r.data),
  pollResult: async (id: string, max = 30): Promise<any> => {
    for (let i = 0; i < max; i++) {
      const r = await ecgAPI.getResult(id);
      if (r.status !== 'processing' && r.status !== 'pending') return r;
      await new Promise((res) => setTimeout(res, 2000));
    }
    throw new Error('Analysis timeout — please retry');
  },
};

export const xrayAPI = {
  upload: (form: FormData) =>
    api.post('/xray/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data),
};

export const labsAPI = {
  interpret: (patient_id: string, values: Record<string, number>, context?: string) =>
    api.post('/labs/interpret', { patient_id, values, patient_context: context || '' }).then((r) => r.data),
};

export const patientsAPI = {
  list: (params?: any) => api.get('/patients', { params }).then((r) => r.data),
  get: (id: string) => api.get(`/patients/${id}`).then((r) => r.data),
  create: (data: any) => api.post('/patients', data).then((r) => r.data),
};

export const reportsAPI = {
  generate: (data: { study_id: string; language: string; clinical_notes?: string }) =>
    api.post('/reports/generate', data).then((r) => r.data),
};

export const alertsAPI = {
  list: (params?: any) => api.get('/alerts', { params }).then((r) => r.data),
  acknowledge: (id: string) => api.post(`/alerts/${id}/acknowledge`).then((r) => r.data),
};

export default api;

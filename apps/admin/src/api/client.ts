import axios from 'axios';

const API_BASE: string = import.meta.env.VITE_API_BASE || '/api';

export const api = axios.create({ baseURL: API_BASE, withCredentials: true });

// 管理端 CSRF 头
api.interceptors.request.use((cfg) => {
  cfg.headers['X-Requested-With'] = 'XMLHttpRequest';
  return cfg;
});

// 401 时先尝试 refresh 一次，再重放原请求
api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const { config, response } = error;
    const status = response?.status as number | undefined;
    const url: string | undefined = config?.url;
    if (status === 401 && url && url !== '/auth/login' && url !== '/auth/refresh' && !config?._retried) {
      config._retried = true;
      try {
        await axios.post(API_BASE + '/auth/refresh', undefined, { withCredentials: true });
        return api(config);
      } catch {
        if (!window.location.pathname.startsWith(import.meta.env.BASE_URL + 'login')) {
          window.location.href = import.meta.env.BASE_URL + 'login';
        }
      }
    }
    const data = response?.data as { error?: { message?: string } } | undefined;
    const msg = data?.error?.message ?? error?.message ?? '请求失败';
    return Promise.reject(new Error(msg));
  },
);

export async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const { data } = await api.get(url, { params });
  return data as T;
}
export async function post<T>(url: string, body?: unknown): Promise<T> {
  const { data } = await api.post(url, body);
  return data as T;
}
export async function put<T>(url: string, body?: unknown): Promise<T> {
  const { data } = await api.put(url, body);
  return data as T;
}
export async function del<T>(url: string): Promise<T> {
  const { data } = await api.delete(url);
  return data as T;
}

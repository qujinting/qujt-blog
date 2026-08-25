import axios from 'axios';

export const api = axios.create({ baseURL: '/api', withCredentials: true });

// 401 时先尝试 refresh 一次，再重放原请求；refresh 失败派发会话失效事件
api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const { config, response } = error;
    const status = response?.status as number | undefined;
    const url: string | undefined = config?.url;
    if (status === 401 && url && url !== '/auth/login' && url !== '/auth/refresh' && !config?._retried) {
      config._retried = true;
      try {
        await axios.post('/api/auth/refresh', undefined, { withCredentials: true });
        return api(config);
      } catch {
        window.dispatchEvent(new CustomEvent('qujt:unauthorized'));
      }
    }
    return Promise.reject(error);
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

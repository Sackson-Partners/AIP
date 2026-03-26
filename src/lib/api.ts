import axios from 'axios';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  'https://aip-api.politesea-b4c1d412.southafricanorth.azurecontainerapps.io';

export const api = axios.create({
  baseURL: `${API_BASE}/api`,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach token to every request
api.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined'
    ? localStorage.getItem('aip_token')
    : null;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401
api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('aip_token');
      localStorage.removeItem('aip_user');
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth
export const authAPI = {
  login: async (email: string, password: string) => {
    const form = new URLSearchParams();
    form.append('username', email);
    form.append('password', password);
    const { data } = await api.post('/auth/token', form.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    localStorage.setItem('aip_token', data.access_token);
    return data;
  },
  me: () => api.get('/auth/me'),
  logout: () => {
    localStorage.removeItem('aip_token');
    localStorage.removeItem('aip_user');
    window.location.href = '/login';
  },
};

// Resources
export const projectsAPI = {
  list:   (p?: object) => api.get('/projects', { params: p }),
  get:    (id: string) => api.get(`/projects/${id}`),
  create: (d: object) => api.post('/projects', d),
  update: (id: string, d: object) => api.patch(`/projects/${id}`, d),
  delete: (id: string) => api.delete(`/projects/${id}`),
};

export const investorsAPI = {
  list:   (p?: object) => api.get('/investors', { params: p }),
  get:    (id: string) => api.get(`/investors/${id}`),
  create: (d: object) => api.post('/investors', d),
  update: (id: string, d: object) => api.patch(`/investors/${id}`, d),
};

export const pipelineAPI = {
  stages:   () => api.get('/pipeline/stages'),
  overview: () => api.get('/pipeline/overview'),
  seed:     () => api.post('/pipeline/init'),
  move:     (projectId: string, d: object) => api.post(`/pipeline/move`, { project_id: projectId, ...d }),
};

export const analyticsAPI = {
  summary: () => api.get('/analytics'),
  track:   (d: object) => api.post('/analytics/track', d),
};

export const eventsAPI = {
  list:   (p?: object) => api.get('/events', { params: p }),
  create: (d: object) => api.post('/events', d),
};

export const usersAPI = {
  list:   () => api.get('/users'),
  get:    (id: string) => api.get(`/users/${id}`),
  update: (id: string, d: object) => api.patch(`/users/${id}`, d),
};

export const dataRoomsAPI = {
  list:   () => api.get('/data-rooms'),
  get:    (id: string) => api.get(`/data-rooms/${id}`),
  create: (d: object) => api.post('/data-rooms', d),
};

export const dealRoomsAPI = {
  list:   () => api.get('/deal-rooms'),
  get:    (id: string) => api.get(`/deal-rooms/${id}`),
  create: (d: object) => api.post('/deal-rooms', d),
};

export const petfelAPI = {
  list:   () => api.get('/petfel'),
  get:    (id: string) => api.get(`/petfel/${id}`),
  assess: (projectId: string, d: object) => api.post(`/petfel/assess/${projectId}`, d),
};

export const einAPI = {
  list:   () => api.get('/ein'),
  get:    (projectId: string) => api.get(`/ein/${projectId}`),
  create: (projectId: string) => api.post(`/ein/${projectId}`, {}),
};

export const icAPI = {
  list:   () => api.get('/ic'),
  committees: () => api.get('/ic/committees'),
  create: (d: object) => api.post('/ic/committees', d),
};

export const matchingAPI = {
  list:  () => api.get('/matching'),
  run:   (projectId: string) => api.post(`/matching/run/${projectId}`, {}),
  get:   (projectId: string) => api.get(`/matching/${projectId}`),
};

export const radarAPI = {
  list:   () => api.get('/radar'),
  results: () => api.get('/radar/results'),
  scan:   () => api.post('/radar/scan', {}),
};

export default api;

export const BASE_URL = import.meta.env.VITE_API_URL;
export const API_PREFIX = import.meta.env.VITE_API_PREFIX; // New environment variable
export const FULL_API_URL = `${BASE_URL}${API_PREFIX}`


if (import.meta.env.DEV) {
  // code inside here will be tree-shaken in production builds
  console.log('Dev mode');
  console.log({BASE_URL, API_PREFIX})
}


export const NAVBAR_MENU = [
  { name: 'home', path: '/' },
  { name: 'analysis', path: '/analysis' },
  { name: 'upload', path: '/upload' },
  { name: 'list', path: '/view' },
  { name: 'search', path: '/search' },
  { name: 'chat', path: '/chat' },
  { name: 'about', path: '/about', enable: false },
]
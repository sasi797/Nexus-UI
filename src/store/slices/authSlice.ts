import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
}

const loadFromStorage = (): AuthState => {
  if (typeof window === 'undefined') return { accessToken: null, refreshToken: null, user: null };
  return {
    accessToken: sessionStorage.getItem('bts_access_token'),
    refreshToken: sessionStorage.getItem('bts_refresh_token'),
    user: JSON.parse(sessionStorage.getItem('bts_user') ?? 'null'),
  };
};

const initialState: AuthState = loadFromStorage();

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials(state, { payload }: PayloadAction<{ accessToken: string; refreshToken: string; user: AuthUser }>) {
      state.accessToken = payload.accessToken;
      state.refreshToken = payload.refreshToken;
      state.user = payload.user;
      sessionStorage.setItem('bts_access_token', payload.accessToken);
      sessionStorage.setItem('bts_refresh_token', payload.refreshToken);
      sessionStorage.setItem('bts_user', JSON.stringify(payload.user));
    },
    setTokens(state, { payload }: PayloadAction<{ accessToken: string; refreshToken: string }>) {
      state.accessToken = payload.accessToken;
      state.refreshToken = payload.refreshToken;
      sessionStorage.setItem('bts_access_token', payload.accessToken);
      sessionStorage.setItem('bts_refresh_token', payload.refreshToken);
    },
    logout(state) {
      state.accessToken = null;
      state.refreshToken = null;
      state.user = null;
      sessionStorage.removeItem('bts_access_token');
      sessionStorage.removeItem('bts_refresh_token');
      sessionStorage.removeItem('bts_user');
    },
  },
});

export const { setCredentials, setTokens, logout } = authSlice.actions;
export default authSlice.reducer;

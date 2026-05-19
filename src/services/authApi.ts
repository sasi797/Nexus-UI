import { api } from './api';

export interface LoginRequest { email: string; password: string }
export interface TokenResponse { access_token: string; refresh_token: string; token_type: string }
export interface MeResponse { id: string; name: string; email: string; role: string }

export const authApi = api.injectEndpoints({
  endpoints: (build) => ({
    login: build.mutation<TokenResponse, LoginRequest>({
      query: (body) => ({ url: '/auth/login', method: 'POST', body }),
    }),
    logout: build.mutation<void, void>({
      query: () => ({ url: '/auth/logout', method: 'POST' }),
    }),
    me: build.query<MeResponse, void>({
      query: () => '/auth/me',
    }),
  }),
  overrideExisting: false,
});

export const { useLoginMutation, useLogoutMutation, useMeQuery } = authApi;

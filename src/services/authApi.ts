import { api } from './api';

export interface LoginRequest { email: string; password: string }
export interface TokenResponse { access_token: string; refresh_token: string; token_type: string }
export interface MeResponse { id: string; name: string; email: string; role: string }
export interface ResetPasswordRequest { email: string; new_password: string; confirm_password: string }

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
    resetPassword: build.mutation<void, ResetPasswordRequest>({
      query: (body) => ({ url: '/auth/reset-password', method: 'POST', body }),
    }),
  }),
  overrideExisting: false,
});

export const { useLoginMutation, useLogoutMutation, useMeQuery, useResetPasswordMutation } = authApi;

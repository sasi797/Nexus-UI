import { api } from './api';

export interface Role {
  id: string;
  name: string;
  key: string;
  permissions: string;
  user_count: number;
  created_at: string;
  updated_at: string;
}

export const rolesApi = api.injectEndpoints({
  endpoints: (build) => ({
    getRoles: build.query<Role[], void>({
      query: () => '/roles',
      providesTags: ['Role'],
    }),
  }),
});

export const { useGetRolesQuery } = rolesApi;

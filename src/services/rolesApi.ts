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

export interface RoleCreate {
  name: string;
  key: string;
  permissions: string;
}

export interface RoleUpdate {
  name?: string;
  key?: string;
  permissions?: string;
}

export const rolesApi = api.injectEndpoints({
  endpoints: (build) => ({
    getRoles: build.query<Role[], void>({
      query: () => '/roles',
      providesTags: ['Role'],
    }),
    createRole: build.mutation<Role, RoleCreate>({
      query: (body) => ({ url: '/roles', method: 'POST', body }),
      invalidatesTags: ['Role'],
    }),
    updateRole: build.mutation<Role, { id: string; body: RoleUpdate }>({
      query: ({ id, body }) => ({ url: `/roles/${id}`, method: 'PUT', body }),
      invalidatesTags: ['Role'],
    }),
    deleteRole: build.mutation<void, string>({
      query: (id) => ({ url: `/roles/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Role'],
    }),
  }),
});

export const { useGetRolesQuery, useCreateRoleMutation, useUpdateRoleMutation, useDeleteRoleMutation } = rolesApi;

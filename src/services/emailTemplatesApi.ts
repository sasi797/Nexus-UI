import { api } from './api';

export interface EmailTemplate {
  id: string;
  name: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export const emailTemplatesApi = api.injectEndpoints({
  endpoints: (build) => ({
    getEmailTemplates: build.query<EmailTemplate[], void>({
      query: () => '/email-templates',
      providesTags: ['EmailTemplate'],
    }),
    createEmailTemplate: build.mutation<EmailTemplate, { name: string; body: string }>({
      query: (body) => ({ url: '/email-templates', method: 'POST', body }),
      invalidatesTags: ['EmailTemplate'],
    }),
    updateEmailTemplate: build.mutation<EmailTemplate, { id: string; body: { name?: string; body?: string } }>({
      query: ({ id, body }) => ({ url: `/email-templates/${id}`, method: 'PUT', body }),
      invalidatesTags: ['EmailTemplate'],
    }),
    deleteEmailTemplate: build.mutation<void, string>({
      query: (id) => ({ url: `/email-templates/${id}`, method: 'DELETE' }),
      invalidatesTags: ['EmailTemplate'],
    }),
  }),
});

export const {
  useGetEmailTemplatesQuery,
  useCreateEmailTemplateMutation,
  useUpdateEmailTemplateMutation,
  useDeleteEmailTemplateMutation,
} = emailTemplatesApi;

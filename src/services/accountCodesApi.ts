import { api } from './api';

export interface AccountCode {
  id:   number;
  code: string;
  name: string;
  site: string;
}

export const accountCodesApi = api.injectEndpoints({
  endpoints: (build) => ({
    getAccountCodes: build.query<AccountCode[], string | void>({
      query: (q) => ({
        url: '/account-codes',
        params: q ? { q } : undefined,
      }),
    }),
  }),
});

export const { useGetAccountCodesQuery } = accountCodesApi;

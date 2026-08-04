export const authHeaders = {
  Authorization: `Bearer ${process.env.API_TOKEN ?? 'qa-lab-token'}`
};

export const invalidAuthHeaders = {
  Authorization: 'Bearer token-invalido-para-teste'
};

export const decodeProtectedHeader = () => ({ kid: 'mock-kid' });
export const importJWK = async () => ({});
export const jwtVerify = async () => ({
  payload: {},
  protectedHeader: { kid: 'mock-kid' },
});

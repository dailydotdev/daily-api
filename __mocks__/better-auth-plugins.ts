export const captcha = () => ({
  id: 'captcha',
  options: {},
});

export const emailOTP = () => ({
  id: 'email-otp',
  endpoints: {},
  hooks: { after: [] },
  rateLimit: [],
  options: {},
});

export const oneTap = (options = {}) => ({
  id: 'one-tap',
  endpoints: {},
  options,
});

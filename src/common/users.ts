import fetch from 'node-fetch';

interface UserInfo {
  name?: string;
  email?: string;
}

const authorizedHeaders = (userId: string): { [key: string]: string } => ({
  authorization: `Service ${process.env.GATEWAY_SECRET}`,
  'user-id': userId,
  'logged-in': 'true',
});

export const fetchUserInfo = async (userId: string): Promise<UserInfo> => {
  const res = await fetch(`${process.env.GATEWAY_URL}/v1/users/me/info`, {
    method: 'GET',
    headers: authorizedHeaders(userId),
  });
  return res.json();
};

export const fetchUserRoles = async (userId: string): Promise<string[]> => {
  const res = await fetch(`${process.env.GATEWAY_URL}/v1/users/me/roles`, {
    method: 'GET',
    headers: authorizedHeaders(userId),
  });
  return res.json();
};

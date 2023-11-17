import { http, HttpResponse } from 'msw';
import { heimdallOrigin } from '../kratos';

const handlers = [
  http.get(`${heimdallOrigin}/api/whoami`, () => {
    console.log('going through mock');
    return HttpResponse.json({
      active: true,
      authenticated_at: '2023-11-16T14:58:31.696565Z',
      authentication_methods: [
        {
          aal: 'aal1',
          completed_at: '2023-11-16T14:58:31.163914458Z',
          method: 'oidc',
        },
      ],
      authenticator_assurance_level: 'aal1',
      devices: [],
      expires_at: '2023-11-17T14:58:32.936667084Z',
      id: '883f8d3c-dc2e-4871-8bd7-ae5c05148ff1',
      identity: {
        created_at: '2023-11-16T14:58:31.140376Z',
        id: '56ec3401-50d5-4eb2-a5bb-60267a6fbab7',
        recovery_addresses: [],
        schema_id: 'default',
        schema_url: 'http://sso.local.com/schemas/ZGVmYXVsdA',
        state: 'active',
        state_changed_at: '2023-11-16T14:58:31.132241Z',
        traits: {
          acceptedMarketing: false,
          email: 'lee@daily.dev',
          image:
            'https://lh3.googleusercontent.com/a/ACg8ocKrSSjpXo7WxoS6PsNOtWyQV8SNQlY_7976EZYuMqRtzQ=s96-c',
          name: 'Lee Hansel Solevilla',
          timezone: 'Asia/Chongqing',
          userId: 'c6tXGU1SMxVtWUrmfYZnj',
        },
        updated_at: '2023-11-16T14:58:31.140376Z',
        verifiable_addresses: [],
      },
      issued_at: '2023-11-16T14:58:31.163515Z',
    });
  }),
];

export default handlers;

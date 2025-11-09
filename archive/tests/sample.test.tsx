jest.mock('next/navigation', () => ({
  redirect: jest.fn(),
}));

const { redirect } = require('next/navigation') as { redirect: jest.Mock };
const RootRedirect = require('@/app/page').default as () => void;

describe('RootRedirect', () => {
  it('redirects visitors to /analytics', () => {
    RootRedirect();
    expect(redirect).toHaveBeenCalledWith('/analytics');
  });
});

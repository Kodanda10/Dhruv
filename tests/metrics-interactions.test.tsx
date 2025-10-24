/// <reference types="jest" />
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';

// Simplified router mock: shared pushMock closed over by jest.mock.
// Expose it on the mock module as __pushMock for assertions.
jest.mock('next/navigation', () => {
  const pushMock = jest.fn();
  return {
    __esModule: true,
    useRouter: () => ({ push: pushMock }),
    __pushMock: pushMock,
  };
});

// Import after the mock so the component uses the mocked router
import * as nextNavigation from 'next/navigation';
import Metrics from '@/components/Metrics';

function getPushMock(): jest.Mock {
  return (nextNavigation as any).__pushMock as jest.Mock;
}

describe('Metrics interactions (router mocked)', () => {
  beforeEach(() => {
    getPushMock().mockReset();
  });

  it('clicks top location item and calls router.push with encoded loc param', () => {
    render(<Metrics />);

    // Button accessible name comes from aria-label
    const raigarhButton = screen.getByRole('button', { name: 'रायगढ़ पर फ़िल्टर करें' });
    fireEvent.click(raigarhButton);

    const expected = `/?loc=${encodeURIComponent('रायगढ़')}`;
    expect(getPushMock()).toHaveBeenCalledTimes(1);
    expect(getPushMock()).toHaveBeenCalledWith(expected);
  });

  it('clicks top action item and calls router.push with encoded action param', () => {
    render(<Metrics />);

    const actionButton = screen.getByRole('button', { name: 'birthday_wishes पर फ़िल्टर करें' });
    fireEvent.click(actionButton);

    const expected = `/?action=${encodeURIComponent('birthday_wishes')}`;
    expect(getPushMock()).toHaveBeenCalledTimes(1);
    expect(getPushMock()).toHaveBeenCalledWith(expected);
  });
});

import { renderHook } from '@testing-library/react';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

describe('useKeyboardShortcuts', () => {
  const mockCallback1 = jest.fn();
  const mockCallback2 = jest.fn();

  const shortcuts = [
    { key: 'a', callback: mockCallback1 },
    { key: 'b', ctrlKey: true, callback: mockCallback2 },
  ];

  let eventMap: { [key: string]: (event: Partial<KeyboardEvent>) => void } = {};

  beforeEach(() => {
    jest.clearAllMocks();
    eventMap = {};
    jest.spyOn(window, 'addEventListener').mockImplementation((event, cb) => {
      eventMap[event] = cb as (event: Partial<KeyboardEvent>) => void;
    });
    jest.spyOn(window, 'removeEventListener').mockImplementation(event => {
      delete eventMap[event];
    });
  });

  test('should add event listener on mount and remove on unmount', () => {
    const { unmount } = renderHook(() => useKeyboardShortcuts(shortcuts));
    expect(window.addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));

    unmount();
    expect(window.removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
  });

  test('should call the correct callback for a simple key press', () => {
    renderHook(() => useKeyboardShortcuts(shortcuts));
    
    // Simulate key press
    eventMap.keydown({ key: 'a', preventDefault: jest.fn() });

    expect(mockCallback1).toHaveBeenCalledTimes(1);
    expect(mockCallback2).not.toHaveBeenCalled();
  });

  test('should call the correct callback for a key press with a modifier', () => {
    renderHook(() => useKeyboardShortcuts(shortcuts));

    // Simulate key press
    eventMap.keydown({ key: 'b', ctrlKey: true, preventDefault: jest.fn() });

    expect(mockCallback2).toHaveBeenCalledTimes(1);
    expect(mockCallback1).not.toHaveBeenCalled();
  });

  test('should not call a callback if the modifier does not match', () => {
    renderHook(() => useKeyboardShortcuts(shortcuts));

    // Simulate key press without modifier
    eventMap.keydown({ key: 'b', ctrlKey: false, preventDefault: jest.fn() });

    expect(mockCallback1).not.toHaveBeenCalled();
    expect(mockCallback2).not.toHaveBeenCalled();
  });
});

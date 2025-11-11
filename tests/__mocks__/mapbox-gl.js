module.exports = {
  Map: jest.fn(() => ({
    on: jest.fn(),
    remove: jest.fn(),
  })),
  Marker: jest.fn(() => ({
    setLngLat: jest.fn().mockReturnThis(),
    setPopup: jest.fn().mockReturnThis(),
    addTo: jest.fn().mockReturnThis(),
  })),
  Popup: jest.fn(),
};

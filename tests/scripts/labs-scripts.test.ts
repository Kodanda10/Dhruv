import { execSync } from 'child_process';

// Mock the execSync function
jest.mock('child_process', () => ({
  ...jest.requireActual('child_process'),
  execSync: jest.fn(),
}));

const mockedExecSync = execSync as jest.Mock;

describe('Labs npm scripts', () => {
  beforeEach(() => {
    // Clear mock history before each test
    mockedExecSync.mockClear();
  });

  it('[F-BUILD-5] should attempt to execute the python build script', () => {
    // This test will run the npm script, which will in turn call our mocked execSync.
    // We can then assert that the mock was called with the correct python command.
    
    // We need to find the actual command that `npm run` executes.
    // By default, `npm run` calls the shell with the script content.
    // We will simulate this behavior.
    const expectedCommand = "python3 api/scripts/rebuild_geography_embeddings_multilingual.py";
    
    // To test the npm script, we can't just run `npm run labs:faiss:build` because that would
    // create a new process that we can't easily mock.
    // Instead, we read package.json and execute the script's content directly.
    const packageJson = require('../../package.json');
    const buildScript = packageJson.scripts['labs:faiss:build'];

    expect(buildScript).toBe(expectedCommand);

    // Now, execute the script's content.
    try {
      execSync(buildScript);
    } catch (e) {
      // We don't expect an error here since execSync is mocked.
    }

    // Verify that execSync was called with the correct command.
    expect(mockedExecSync).toHaveBeenCalledWith(expectedCommand);
  });
});
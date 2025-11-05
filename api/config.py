import os

def is_flag_enabled(flag_name):
    """Checks if a feature flag is enabled via environment variables."""
    return os.environ.get(flag_name, 'false').lower() == 'true'

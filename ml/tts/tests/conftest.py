import pytest

from tts import registry


@pytest.fixture(autouse=True)
def _clean_registry():
    """Clear the global registry before and after each test.

    IMPORTANT: The registry is a module-level global. Backends self-register
    at import time (when tts.kokoro_backend, tts.parler_backend, and app are
    imported). This fixture clears the registry before/after each test for
    isolation, which also removes those import-time registrations.

    As a result, each test MUST explicitly register the backend(s) it needs
    (e.g., FakeBackend). Relying on import-time self-registration will NOT
    work, and forgetting to register a fake for a real model name could
    trigger an actual model download.
    """
    registry.clear()
    yield
    registry.clear()

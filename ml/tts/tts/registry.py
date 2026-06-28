"""Name -> backend registry with lazy instantiation and caching."""
from tts.base import TTSBackend

_CLASSES: dict[str, type[TTSBackend]] = {}
_INSTANCES: dict[str, TTSBackend] = {}


def register(name: str, cls: type[TTSBackend]) -> None:
    _CLASSES[name] = cls


def available_models() -> list[str]:
    return sorted(_CLASSES)


def get(name: str) -> TTSBackend:
    """Return a loaded backend, instantiating and loading it on first use."""
    if name not in _CLASSES:
        raise KeyError(name)
    if name not in _INSTANCES:
        backend = _CLASSES[name]()
        backend.load()
        _INSTANCES[name] = backend
    return _INSTANCES[name]


def clear() -> None:
    """Test helper: drop all registrations and cached instances."""
    _CLASSES.clear()
    _INSTANCES.clear()

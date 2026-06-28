import pytest

from tts import registry
from tests.fakes import FakeBackend


def test_register_and_available_models():
    registry.register("fake", FakeBackend)
    assert registry.available_models() == ["fake"]


def test_available_models_is_sorted():
    registry.register("zeta", FakeBackend)
    registry.register("alpha", FakeBackend)
    assert registry.available_models() == ["alpha", "zeta"]


def test_get_lazy_loads_and_caches():
    registry.register("fake", FakeBackend)
    first = registry.get("fake")
    second = registry.get("fake")
    assert first is second          # cached, same instance
    assert first.load_calls == 1    # loaded exactly once


def test_get_unknown_raises_keyerror():
    with pytest.raises(KeyError):
        registry.get("does-not-exist")

"""Event listener with Redis fully faked; the worker thread is run inline, never really started."""
import json
import logging
import sys
import types

import pytest

from app.services import event_listener as el


class Stop(BaseException):
    """Raised by the fake to break a hypothetical retry loop (not caught by `except Exception`)."""


class FakePubSub:
    def __init__(self, script):
        self.script, self.subscribed = script, []

    def subscribe(self, ch):
        self.subscribed.append(ch)

    def listen(self):
        for item in self.script:
            if isinstance(item, BaseException):
                raise item
            yield item


class FakeRedisModule(types.ModuleType):
    """scripts: one list of messages (or exceptions to raise) per connection attempt."""
    def __init__(self, scripts, connect_exc=None):
        super().__init__("redis")
        self.scripts, self.connect_exc, self.connections, self.pubsubs = list(scripts), connect_exc, [], []
        outer = self

        class Redis:
            def __init__(self, **kw):
                if outer.connect_exc:
                    raise outer.connect_exc
                outer.connections.append(kw)
                if not outer.scripts:
                    raise Stop()
                self._ps = FakePubSub(outer.scripts.pop(0))
                outer.pubsubs.append(self._ps)

            def pubsub(self):
                return self._ps
        self.Redis = Redis


@pytest.fixture
def run(monkeypatch):
    """run(scripts, **kw) -> (fake_redis, thread_info). Executes the worker synchronously."""
    sleeps, info = [], {}

    class InlineThread:
        def __init__(self, target, daemon=None, **kw):
            info.update(daemon=daemon, started=False)
            self.target = target

        def start(self):
            info["started"] = True
            try:
                self.target()
            except Stop:
                info["stopped"] = True

    monkeypatch.setattr(el.threading, "Thread", InlineThread)
    monkeypatch.setattr(el.time, "sleep", lambda s: sleeps.append(s))

    def go(scripts, **kw):
        fake = FakeRedisModule(scripts, **kw)
        monkeypatch.setitem(sys.modules, "redis", fake)
        el.start_redis_listener()
        info["sleeps"] = sleeps
        return fake, info
    return go


def msg(obj, type_="message"):
    return {"type": type_, "data": obj if isinstance(obj, str) else json.dumps(obj)}


def test_starts_daemon_thread_and_subscribes(run, monkeypatch):
    monkeypatch.setattr(el, "REDIS_HOST", "h"); monkeypatch.setattr(el, "REDIS_PORT", 1234)
    fake, info = run([[]])
    assert info["started"] and info["daemon"] is True
    assert fake.connections == [{"host": "h", "port": 1234, "decode_responses": True}]
    assert fake.pubsubs[0].subscribed == ["terrawatch:events"] == [el.CHANNEL_NAME]
    assert info["sleeps"] == [2]


def test_env_defaults():
    assert el.CHANNEL_NAME == "terrawatch:events"
    assert isinstance(el.REDIS_PORT, int)


def test_scene_ingested_event_is_logged(run, caplog):
    caplog.set_level(logging.INFO, logger="ai_event_listener")
    run([[msg({"eventType": "SATELLITE_SCENE_INGESTED", "eventId": "e1", "payload": {"scene_id": "S2A_1"}})]])
    text = caplog.text
    assert "SATELLITE_SCENE_INGESTED" in text and "e1" in text
    assert "Initiating automated landslide segmentation for scene: S2A_1" in text


def test_other_event_does_not_trigger_processing(run, caplog):
    caplog.set_level(logging.INFO, logger="ai_event_listener")
    run([[msg({"eventType": "OTHER", "eventId": "e2", "payload": {}})]])
    assert "Inbound" in caplog.text and "Initiating" not in caplog.text


def test_missing_fields_use_defaults(run, caplog):
    caplog.set_level(logging.INFO, logger="ai_event_listener")
    run([[msg({})]])
    assert "Type: UNKNOWN | ID: N/A" in caplog.text


def test_non_message_types_are_ignored(run, caplog):
    caplog.set_level(logging.INFO, logger="ai_event_listener")
    run([[msg(1, "subscribe"), {"type": "pong", "data": "x"}, None]])
    assert "Inbound" not in caplog.text and "Warning" not in caplog.text


def test_malformed_json_is_logged_and_listener_continues(run, caplog):
    caplog.set_level(logging.INFO, logger="ai_event_listener")
    run([[msg("{not json"), msg({"eventType": "A", "eventId": "after"})]])
    assert "Failed to parse event message: {not json" in caplog.text
    assert "after" in caplog.text


def test_redis_unreachable_is_logged_not_raised(run, caplog):
    caplog.set_level(logging.WARNING, logger="ai_event_listener")
    fake, info = run([], connect_exc=ConnectionError("refused"))
    assert "Redis not reachable" in caplog.text and "refused" in caplog.text
    assert not info.get("stopped")


def test_redis_package_missing_is_logged(run, monkeypatch, caplog):
    caplog.set_level(logging.WARNING, logger="ai_event_listener")
    monkeypatch.setitem(sys.modules, "redis", None)  # import raises ImportError
    class T:
        def __init__(self, target, daemon=None): self.t = target
        def start(self): self.t()
    monkeypatch.setattr(el.threading, "Thread", T)
    el.start_redis_listener()
    assert "Redis not reachable" in caplog.text


def test_connection_lost_mid_stream_is_logged(run, caplog):
    caplog.set_level(logging.WARNING, logger="ai_event_listener")
    run([[msg({"eventType": "A"}), ConnectionError("lost")]])
    assert "lost" in caplog.text


@pytest.mark.xfail(strict=True, reason="BUG: listener has no reconnect; expected a 2nd connection after ConnectionError mid-stream "
                   "(docstring says retry loop), actual: worker logs warning and thread ends for good")
def test_listener_reconnects_after_connection_error(run, caplog):
    caplog.set_level(logging.INFO, logger="ai_event_listener")
    fake, _ = run([[ConnectionError("lost")], [msg({"eventType": "A", "eventId": "again"})]])
    assert len(fake.connections) >= 2 and "again" in caplog.text


@pytest.mark.xfail(strict=True, reason="BUG: valid JSON that is not an object (e.g. '[1]') makes event.get raise AttributeError; "
                   "expected: skip message and keep consuming, actual: outer except ends the listener, later events are lost")
def test_non_object_json_does_not_kill_listener(run, caplog):
    caplog.set_level(logging.INFO, logger="ai_event_listener")
    run([[msg("[1]"), msg({"eventType": "A", "eventId": "later"})]])
    assert "later" in caplog.text


@pytest.mark.xfail(strict=True, reason="BUG: SATELLITE_SCENE_INGESTED with non-object payload raises AttributeError on payload.get; "
                   "expected: skip message and keep consuming, actual: listener dies and later events are lost")
def test_bad_payload_type_does_not_kill_listener(run, caplog):
    caplog.set_level(logging.INFO, logger="ai_event_listener")
    run([[msg({"eventType": "SATELLITE_SCENE_INGESTED", "payload": "oops"}), msg({"eventType": "A", "eventId": "later"})]])
    assert "later" in caplog.text


@pytest.mark.xfail(strict=True, reason="BUG: message with non-string data (None) makes json.loads raise TypeError (not JSONDecodeError); "
                   "expected: skip message and keep consuming, actual: listener dies")
def test_null_data_does_not_kill_listener(run, caplog):
    caplog.set_level(logging.INFO, logger="ai_event_listener")
    run([[{"type": "message", "data": None}, msg({"eventType": "A", "eventId": "later"})]])
    assert "later" in caplog.text

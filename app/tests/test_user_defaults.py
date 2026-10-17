"""Form defaults edited on the Settings page and stored on the server."""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock

import pytest
from aiohttp import web

import main
from state_store import AtomicJsonStore


@pytest.fixture
def defaults_store(tmp_path, monkeypatch):
    store = AtomicJsonStore(str(tmp_path / "user_defaults.json"), kind="user_defaults")
    monkeypatch.setattr(main, "user_defaults_store", store)
    monkeypatch.setattr(main, "_user_defaults_saved", {})
    emit = AsyncMock()
    monkeypatch.setattr(main.sio, "emit", emit)
    monkeypatch.setattr(main.config, "YTDL_OPTIONS_PRESETS", {"Embed subs": {}, "No playlist": {}})
    monkeypatch.setattr(main.config, "CUSTOM_DIRS", True)
    monkeypatch.setattr(main.dqueue, "set_max_concurrent_downloads", AsyncMock())
    return store, emit


def _json_request(body):
    req = MagicMock(spec=web.Request)
    req.json = AsyncMock(return_value=body)
    return req


def test_builtin_defaults_follow_server_config(monkeypatch):
    monkeypatch.setattr(main.config, "DEFAULT_FOLDER", "Videos")
    monkeypatch.setattr(main.config, "SUBSCRIPTION_DEFAULT_CHECK_INTERVAL", 30)
    values = main.normalize_user_defaults({}, strict=True)
    assert values["folder"] == "Videos"
    assert values["check_interval_minutes"] == 30
    assert values["download_type"] == "video"


def test_valid_values_are_kept(defaults_store):
    values = main.normalize_user_defaults({
        "download_type": "audio",
        "audio": {"format": "mp3", "quality": "320"},
        "video": {"codec": "av1", "format": "mp4", "quality": "1080"},
        "captions": {"format": "vtt", "subtitle_language": "zh-Hans", "subtitle_mode": "auto_only"},
        "folder": "/Music/Albums/",
        "ytdl_options_presets": ["No playlist", "Embed subs", "No playlist"],
        "title_regex": "(?i)keynote",
    }, strict=True)
    assert values["download_type"] == "audio"
    assert values["audio"] == {"format": "mp3", "quality": "320"}
    assert values["video"] == {"codec": "av1", "format": "mp4", "quality": "1080"}
    assert values["captions"]["subtitle_language"] == "zh-Hans"
    assert values["folder"] == "Music/Albums"
    assert values["ytdl_options_presets"] == ["No playlist", "Embed subs"]


@pytest.mark.parametrize("raw", [
    {"download_type": "podcast"},
    {"audio": {"format": "m4a", "quality": "320"}},  # 320 is mp3-only
    {"video": {"quality": "999"}},
    {"folder": "../outside"},
    {"folder": "a/../../etc"},
    {"auto_start": "yes"},
    {"playlist_item_limit": -1},
    {"check_interval_minutes": 0},
    {"title_regex": "("},
    {"ytdl_options_presets": ["Unknown preset"]},
    {"chapter_template": ""},
    {"custom_name_prefix": "two\nlines"},
    {"captions": {"subtitle_language": "not a code!"}},
    {"max_concurrent_downloads": 0},
    {"max_concurrent_downloads": 21},
    {"max_concurrent_downloads": "4"},
])
def test_strict_mode_rejects_invalid_values(defaults_store, raw):
    with pytest.raises(ValueError):
        main.normalize_user_defaults(raw, strict=True)


def test_quality_choices_follow_the_catalog(defaults_store):
    # The format catalog decides which qualities a format offers.
    values = main.normalize_user_defaults({"video": {"format": "ios", "quality": "720"}}, strict=True)
    assert values["video"]["quality"] == "720"
    # A format with only "best" to pick from rejects anything else.
    with pytest.raises(ValueError):
        main.normalize_user_defaults({"audio": {"format": "opus", "quality": "320"}}, strict=True)


def test_stored_values_that_went_stale_fall_back_individually(defaults_store):
    # A preset removed from the server, and an invalid field, must not
    # discard the rest of what the user saved.
    values = main.normalize_user_defaults({
        "download_type": "captions",
        "ytdl_options_presets": ["Embed subs", "Removed preset"],
        "check_interval_minutes": "often",
    }, strict=False)
    assert values["download_type"] == "captions"
    assert values["ytdl_options_presets"] == ["Embed subs"]
    assert values["check_interval_minutes"] == int(main.config.SUBSCRIPTION_DEFAULT_CHECK_INTERVAL)


def test_folder_default_is_dropped_without_custom_dirs(defaults_store, monkeypatch):
    monkeypatch.setattr(main.config, "CUSTOM_DIRS", False)
    assert main.normalize_user_defaults({"folder": "Music"}, strict=True)["folder"] == ""


@pytest.mark.asyncio
async def test_save_stores_only_changed_values_and_broadcasts(defaults_store, monkeypatch):
    store, emit = defaults_store
    monkeypatch.setattr(main.config, "DEFAULT_FOLDER", "")
    body = main.builtin_user_defaults()
    body["download_type"] = "audio"
    body["sponsorblock"] = True

    resp = await main.save_user_defaults(_json_request(body))

    assert resp.status == 200
    assert json.loads(resp.text)["download_type"] == "audio"
    # Unchanged fields are not pinned, so a later DEFAULT_FOLDER still applies.
    assert store.load()["defaults"] == {"download_type": "audio", "sponsorblock": True}
    monkeypatch.setattr(main.config, "DEFAULT_FOLDER", "Later")
    assert main.current_user_defaults()["folder"] == "Later"
    emit.assert_awaited_once()
    assert emit.await_args.args[0] == "defaults"


def test_concurrency_defaults_to_env_and_allows_up_to_its_ceiling(defaults_store, monkeypatch):
    monkeypatch.setattr(main.config, "MAX_CONCURRENT_DOWNLOADS", "5")
    assert main.normalize_user_defaults({}, strict=True)["max_concurrent_downloads"] == 5
    assert main.normalize_user_defaults({"max_concurrent_downloads": 20}, strict=True)["max_concurrent_downloads"] == 20
    # An operator who configured more than the usual ceiling can go that high.
    monkeypatch.setattr(main.config, "MAX_CONCURRENT_DOWNLOADS", "30")
    assert main.normalize_user_defaults({"max_concurrent_downloads": 30}, strict=True)["max_concurrent_downloads"] == 30


@pytest.mark.asyncio
async def test_save_applies_the_concurrency_limit(defaults_store):
    await main.save_user_defaults(_json_request({"max_concurrent_downloads": 1}))
    main.dqueue.set_max_concurrent_downloads.assert_awaited_with(1)


@pytest.mark.asyncio
async def test_save_rejects_invalid_values_without_storing(defaults_store):
    store, emit = defaults_store
    with pytest.raises(web.HTTPBadRequest):
        await main.save_user_defaults(_json_request({"auto_start": "maybe"}))
    assert store.load() is None
    emit.assert_not_awaited()


@pytest.mark.asyncio
async def test_reset_returns_to_builtin_values(defaults_store):
    store, _ = defaults_store
    await main.save_user_defaults(_json_request({"download_type": "thumbnail"}))

    resp = await main.reset_user_defaults(MagicMock(spec=web.Request))

    assert json.loads(resp.text)["download_type"] == "video"
    assert store.load()["defaults"] == {}


@pytest.mark.asyncio
async def test_get_returns_current_values(defaults_store):
    await main.save_user_defaults(_json_request({"auto_start": False}))
    resp = await main.get_user_defaults(MagicMock(spec=web.Request))
    assert json.loads(resp.text)["auto_start"] is False


def test_settings_page_serves_the_app():
    paths = {
        route.resource.canonical
        for route in main.app.router.routes()
        if route.method == "GET" and route.handler is main.index
    }
    assert main.config.URL_PREFIX + "settings" in paths

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChangeDetectorRef, signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subject, of } from 'rxjs';
import { App, plainAddError, regexErrorMessage } from './app';
import { AddDownloadPayload, DownloadsService } from './services/downloads.service';
import { SubscriptionsService } from './services/subscriptions.service';
import { ToastService } from './services/toast.service';
import { DefaultsService } from './services/defaults.service';
import { CookieService } from 'ngx-cookie-service';
import { SettingsStore } from './services/settings-store.service';
import { Download, FormDefaults, FormatCatalog } from './interfaces';
import { DoneEntryComponent, DownloadRowComponent } from './components';

const choice = (def: string, ...pairs: [string, string][]) => ({
  default: def,
  options: pairs.map(([id, text]) => ({ id, text })),
});

// Shaped like the catalog app/format_catalog.py sends; the tests rely on its
// shape and a few of its entries, not on it matching the real one.
function testCatalog(): FormatCatalog {
  const videoQuality = choice('best', ['best', 'Best'], ['1080', '1080p'], ['720', '720p'], ['worst', 'Worst']);
  const bestOnly = choice('best', ['best', 'Best']);
  return {
    download_type: {
      default: 'video',
      options: [
        {
          id: 'video',
          text: 'Video',
          codec: choice('auto', ['auto', 'Auto'], ['h264', 'H.264'], ['h265', 'H.265 (HEVC)']),
          format: {
            default: 'any',
            options: [
              { id: 'any', text: 'Auto', quality: videoQuality },
              { id: 'mp4', text: 'MP4', quality: videoQuality },
              { id: 'ios', text: 'iOS Compatible', quality: videoQuality },
            ],
          },
        },
        {
          id: 'audio',
          text: 'Audio',
          format: {
            default: 'm4a',
            options: [
              { id: 'auto', text: 'Auto', quality: bestOnly, tags: true },
              { id: 'm4a', text: 'M4A', quality: choice('best', ['best', 'Best'], ['192', '192 kbps']), tags: true },
              { id: 'mp3', text: 'MP3', quality: choice('best', ['best', 'Best'], ['320', '320 kbps']), tags: true },
              { id: 'wav', text: 'WAV', quality: bestOnly, tags: false },
              { id: 'flac', text: 'FLAC', quality: bestOnly, tags: true },
            ],
          },
          audio_tags: choice('with_cover', ['with_cover', 'With cover'], ['no_cover', 'No cover'], ['none', 'None']),
        },
        {
          id: 'captions',
          text: 'Captions',
          format: choice('srt', ['srt', 'SRT'], ['vtt', 'VTT'], ['dfxp', 'DFXP']),
          subtitle_mode: choice('prefer_manual', ['prefer_manual', 'Prefer Manual'], ['auto_only', 'Auto Only']),
          subtitle_language: choice('en', ['en', 'English'], ['de', 'German']),
        },
        {
          id: 'thumbnail',
          text: 'Thumbnail',
          format: choice('jpg', ['jpg', 'JPG']),
        },
      ],
    },
  };
}

class DownloadsServiceStub {
  loading = false;
  queue = new Map();
  done = new Map();
  configuration: Record<string, unknown> = { CUSTOM_DIRS: true, CREATE_CUSTOM_DIRS: true, ALLOW_YTDL_OPTIONS_OVERRIDES: false };
  customDirs = { download_dir: [], audio_download_dir: [] };
  queueChanged = new Subject<void>();
  doneChanged = new Subject<void>();
  configurationChanged = new Subject<Record<string, unknown>>();
  formats: FormatCatalog | null = testCatalog();
  formatsChanged = new Subject<FormatCatalog>();
  customDirsChanged = new Subject<Record<string, string[]>>();
  ytdlOptionsChanged = new Subject<Record<string, unknown>>();
  updated = new Subject<void>();
  retryCalls: string[] = [];

  getCookieStatus() {
    return of({ status: 'ok', has_cookies: false });
  }

  getPresets() {
    return of({ presets: ['Preset A'] });
  }

  add(payload?: unknown) {
    void payload;
    return of({ status: 'ok' as const });
  }

  browse() {
    return of({ status: 'ok' as const, title: '', entries: [] });
  }

  retry(id: string) {
    this.retryCalls.push(id);
    return of({ status: 'ok' as const });
  }

  cancelAdd() {
    return of({ status: 'ok' as const });
  }

  startById() {
    return of({});
  }

  delById() {
    return of({});
  }

  startByFilter() {
    return of({});
  }

  uploadCookies() {
    return of({ status: 'ok' });
  }

  deleteCookies() {
    return of({ status: 'ok' });
  }
}

class SubscriptionsServiceStub {
  subscriptions = new Map();
  subscriptionsChanged = new Subject<void>();
  subscribeCalls: unknown[] = [];

  subscribe(payload: unknown) {
    this.subscribeCalls.push(payload);
    return of({ status: 'ok' as const });
  }

  delete() {
    return of({});
  }

  updateCalls: [string, unknown][] = [];

  update(id: string, changes: unknown) {
    this.updateCalls.push([id, changes]);
    return of({ status: 'ok' as const });
  }

  refreshList() {
    return of([]);
  }
}

class CookieServiceStub {
  private cookies = new Map<string, string>();

  get(name: string) {
    return this.cookies.get(name) ?? '';
  }

  set(name: string, value: string) {
    this.cookies.set(name, value);
  }

  check(name: string) {
    return this.cookies.has(name);
  }

  delete(name: string) {
    this.cookies.delete(name);
  }
}

function formDefaults(overrides: Partial<FormDefaults> = {}): FormDefaults {
  return {
    download_type: 'video',
    video: { codec: 'auto', format: 'any', quality: 'best' },
    audio: { format: 'm4a', quality: 'best' },
    captions: { format: 'srt', subtitle_language: 'en', subtitle_mode: 'prefer_manual' },
    audio_tags: 'with_cover',
    folder: '',
    custom_name_prefix: '',
    auto_start: true,
    playlist_item_limit: 0,
    sponsorblock: false,
    split_by_chapters: false,
    chapter_template: '%(title)s - %(section_number)02d - %(section_title)s.%(ext)s',
    ytdl_options_presets: [],
    check_interval_minutes: 60,
    title_regex: '',
    skip_subscriber_only: false,
    max_concurrent_downloads: 3,
    ...overrides,
  };
}

class DefaultsServiceStub {
  defaults = signal<FormDefaults | null>(null);
}

describe('App', () => {
  let downloads: DownloadsServiceStub;
  let defaults: DefaultsServiceStub;

  beforeEach(async () => {
    localStorage.clear();
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      enumerable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    // jsdom has no ResizeObserver; the folder autocomplete and presets
    // combobox use one to size their dropdowns.
    Object.defineProperty(window, 'ResizeObserver', {
      writable: true,
      value: class {
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = vi.fn();
      },
    });
    downloads = new DownloadsServiceStub();
    defaults = new DefaultsServiceStub();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        { provide: DefaultsService, useValue: defaults },
        { provide: DownloadsService, useValue: downloads },
        { provide: SubscriptionsService, useClass: SubscriptionsServiceStub },
        { provide: CookieService, useClass: CookieServiceStub },
        {
          provide: HttpClient,
          useValue: {
            get: vi.fn().mockReturnValue(of({ 'yt-dlp': 'test', version: 'test' })),
          },
        },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('pre-fills the download folder from the server defaults', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    defaults.defaults.set(formDefaults({ folder: 'youtube' }));
    fixture.detectChanges();

    expect(fixture.componentInstance.folder).toBe('youtube');
  });

  it('does not overwrite a folder the user already typed', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    fixture.componentInstance.folder = 'music';

    defaults.defaults.set(formDefaults({ folder: 'youtube' }));
    fixture.detectChanges();

    expect(fixture.componentInstance.folder).toBe('music');
  });

  // The form remembers a choice the user made (in a cookie); everything else
  // follows the defaults saved on the Settings page.
  describe('form defaults from the server', () => {
    const create = () => {
      const fixture = TestBed.createComponent(App);
      fixture.detectChanges();
      return fixture;
    };
    const send = (fixture: ReturnType<typeof create>, values: FormDefaults) => {
      defaults.defaults.set(values);
      fixture.detectChanges();
    };

    it('fills every field nothing is remembered for', () => {
      const fixture = create();
      send(fixture, formDefaults({
        download_type: 'audio',
        audio: { format: 'mp3', quality: '320' },
        auto_start: false,
        ytdl_options_presets: ['Preset A'],
        check_interval_minutes: 15,
        title_regex: 'keynote',
      }));
      const app = fixture.componentInstance;

      expect(app.downloadType).toBe('audio');
      expect(app.format).toBe('mp3');
      expect(app.quality).toBe('320');
      expect(app.autoStart).toBe(false);
      expect(app.ytdlOptionsPresets).toEqual(['Preset A']);
      expect(app.checkIntervalMinutes).toBe(15);
      expect(app.titleRegex).toBe('keynote');
    });

    it('keeps a choice the user made', () => {
      const cookies = TestBed.inject(CookieService);
      cookies.set('metube_download_type', 'captions');
      cookies.set('metube_auto_start', 'true');
      const fixture = create();

      send(fixture, formDefaults({ download_type: 'audio', auto_start: false }));

      expect(fixture.componentInstance.downloadType).toBe('captions');
      expect(fixture.componentInstance.autoStart).toBe(true);
    });

    it('follows defaults saved later, except fields edited this session', () => {
      const fixture = create();
      send(fixture, formDefaults({ folder: 'Music', custom_name_prefix: 'a' }));
      fixture.componentInstance.customNamePrefix = 'mine';

      send(fixture, formDefaults({ folder: 'Podcasts', custom_name_prefix: 'b' }));

      expect(fixture.componentInstance.folder).toBe('Podcasts');
      expect(fixture.componentInstance.customNamePrefix).toBe('mine');
    });

    it('switching type alone does not count as a choice', () => {
      const settings = TestBed.inject(SettingsStore);
      const fixture = create();
      send(fixture, formDefaults());
      const app = fixture.componentInstance;

      app.downloadType = 'audio';
      app.downloadTypeChanged();

      expect(settings.has('metube_selection_audio')).toBe(false);
      expect(settings.has('metube_selection_video')).toBe(false);
      // The type itself is a choice.
      expect(settings.get('metube_download_type')).toBe('audio');
    });

    it('Reset to defaults forgets remembered choices', () => {
      const settings = TestBed.inject(SettingsStore);
      settings.set('metube_download_type', 'captions');
      settings.set('metube_sponsorblock', 'true');
      const fixture = create();
      send(fixture, formDefaults({ download_type: 'audio' }));
      const app = fixture.componentInstance;
      app.folder = 'typed';

      app.resetFormToDefaults();

      expect(app.downloadType).toBe('audio');
      expect(app.sponsorblock).toBe(false);
      expect(app.folder).toBe('');
      expect(settings.has('metube_download_type')).toBe(false);
      expect(settings.has('metube_sponsorblock')).toBe(false);
    });
  });

  describe('digitsOnly', () => {
    const press = (key: string, mods: Partial<KeyboardEventInit> = {}) => {
      const fixture = TestBed.createComponent(App);
      const event = new KeyboardEvent('keydown', { key, cancelable: true, ...mods });
      fixture.componentInstance.digitsOnly(event);
      return event.defaultPrevented;
    };

    it('blocks typed characters other than digits', () => {
      for (const key of ['a', '-', '.', 'e', ' ']) {
        expect(press(key)).toBe(true);
      }
      expect(press('7')).toBe(false);
    });

    it('lets shortcuts and named keys through', () => {
      expect(press('v', { ctrlKey: true })).toBe(false);
      expect(press('a', { metaKey: true })).toBe(false);
      expect(press('c', { ctrlKey: true })).toBe(false);
      for (const key of ['Enter', 'Escape', 'Tab', 'ArrowUp', 'ArrowDown', 'Backspace', 'F5']) {
        expect(press(key)).toBe(false);
      }
    });
  });

  it('Retry failed sends at most four retries at a time', () => {
    const pending: Subject<{ status: 'ok' }>[] = [];
    downloads.retry = (id: string) => {
      downloads.retryCalls.push(id);
      const result = new Subject<{ status: 'ok' }>();
      pending.push(result);
      return result;
    };
    for (let i = 0; i < 10; i++) {
      downloads.done.set(`u${i}`, { url: `u${i}`, title: `t${i}`, status: 'error' } as Download);
    }
    downloads.done.set('ok', { url: 'ok', status: 'finished' } as Download);
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    fixture.componentInstance.retryFailedDownloads();
    expect(downloads.retryCalls).toHaveLength(4);

    pending[0].next({ status: 'ok' });
    pending[0].complete();
    expect(downloads.retryCalls).toHaveLength(5);

    for (let i = 1; i < 10; i++) {
      pending[i]?.next({ status: 'ok' });
      pending[i]?.complete();
    }
    expect(downloads.retryCalls).toEqual([...Array(10).keys()].map((i) => `u${i}`));
  });

  it('remembers the list view the pills last switched to', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const app = fixture.componentInstance;
    const settings = TestBed.inject(SettingsStore);

    expect(app.listView).toBe('downloading');

    app.setListView('subscriptions');

    expect(app.listView).toBe('subscriptions');
    expect(settings.get('metube_list_view')).toBe('subscriptions');

    // A fresh component picks the view back up from storage.
    const restored = TestBed.createComponent(App);
    restored.detectChanges();
    expect(restored.componentInstance.listView).toBe('subscriptions');
  });

  it('ignores an unknown stored list view', () => {
    TestBed.inject(SettingsStore).set('metube_list_view', 'bogus');
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance.listView).toBe('downloading');
  });

  it('fades in only downloads added after the first queue update', () => {
    vi.useFakeTimers();
    try {
      const fixture = TestBed.createComponent(App);
      const app = fixture.componentInstance;

      // The list sent on connect is the baseline, not news.
      downloads.queue.set('q1', {});
      downloads.queueChanged.next();
      expect(app.enteringQueueIds.size).toBe(0);

      downloads.queue.set('q2', {});
      downloads.queueChanged.next();
      expect([...app.enteringQueueIds]).toEqual(['q2']);

      // Cleared once played, so switching views back doesn't replay it.
      vi.advanceTimersByTime(300);
      expect(app.enteringQueueIds.size).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('switches to the Downloading view once a download is added', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.setListView('completed');
    app.addUrl = 'https://example.com/v';

    app.addDownload();

    expect(app.listView).toBe('downloading');
  });

  describe('completed and failed views', () => {
    const doneEntry = (url: string, status: string): Download => ({
      id: url,
      title: url,
      url,
      download_type: 'video',
      quality: 'best',
      format: 'any',
      folder: '',
      custom_name_prefix: '',
      playlist_item_limit: 0,
      status,
      msg: '',
      percent: 100,
      speed: 0,
      eta: 0,
      filename: status === 'error' ? '' : `${url}.mp4`,
      checked: false,
    } as Download);

    const setup = () => {
      downloads.done.set('ok1', doneEntry('ok1', 'finished'));
      downloads.done.set('bad1', doneEntry('bad1', 'error'));
      downloads.done.set('ok2', doneEntry('ok2', 'finished'));
      const fixture = TestBed.createComponent(App);
      downloads.doneChanged.next();
      return fixture.componentInstance;
    };

    it('splits the done list by outcome', () => {
      const app = setup();

      app.setListView('completed');
      expect(app.cachedSortedDoneIds).toEqual(['ok2', 'ok1']);
      expect([...app.cachedVisibleDone.keys()]).toEqual(['ok2', 'ok1']);

      app.setListView('failed');
      expect(app.cachedSortedDoneIds).toEqual(['bad1']);
    });

    it('drops the selection when the view changes, so bulk actions never reach hidden rows', async () => {
      const app = setup();
      app.setListView('completed');
      downloads.done.get('ok1')!.checked = true;
      app.doneSelectionChanged(1);
      const delSpy = vi.spyOn(downloads, 'delById');

      app.setListView('failed');
      await app.delSelectedDownloads('done');

      expect(downloads.done.get('ok1')!.checked).toBe(false);
      expect(app.doneSelectedCount).toBe(0);
      expect((delSpy.mock.calls as unknown[][]).flatMap(call => call[1])).not.toContain('ok1');
    });
  });

  it('asIsOrder returns a stable comparator value (insertion order preserved)', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app.asIsOrder()).toBe(0);
  });

  it('hides manual override input when disabled', () => {
    const fixture = TestBed.createComponent(App);
    fixture.componentInstance.isAdvancedOpen = true;
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('input[name="ytdlOptionsOverrides"]')).toBeNull();

    const presetWrapper = root.querySelector('hlm-combobox-multiple[name="ytdlOptionsPresets"]')
      ?.parentElement?.parentElement;
    expect(presetWrapper?.classList.contains('md:col-span-6')).toBe(true);

    const presetRow = root.querySelector('hlm-combobox-multiple[name="ytdlOptionsPresets"]')
      ?.closest('[data-settings-section]');
    expect(presetRow?.querySelector('input[name="checkIntervalMinutes"]')).toBeNull();
    expect(presetRow?.querySelector('input[name="videoPassword"]')).not.toBeNull();
  });

  it('shows manual override input when enabled', () => {
    downloads.configuration['ALLOW_YTDL_OPTIONS_OVERRIDES'] = true;

    const fixture = TestBed.createComponent(App);
    fixture.componentInstance.isAdvancedOpen = true;
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('input[name="ytdlOptionsOverrides"]')).not.toBeNull();

    const presetWrapper = root.querySelector('hlm-combobox-multiple[name="ytdlOptionsPresets"]')
      ?.parentElement?.parentElement;
    expect(presetWrapper?.classList.contains('md:col-span-6')).toBe(true);

    // The JSON overrides get a full-width row of their own below presets + password.
    const overridesWrapper = root.querySelector('input[name="ytdlOptionsOverrides"]')?.parentElement
      ?.parentElement;
    expect(overridesWrapper?.classList.contains('col-span-12')).toBe(true);
    expect(overridesWrapper?.classList.contains('md:col-span-6')).toBe(false);

    const presetRow = root.querySelector('hlm-combobox-multiple[name="ytdlOptionsPresets"]')
      ?.closest('[data-settings-section]');
    expect(presetRow?.querySelector('input[name="checkIntervalMinutes"]')).toBeNull();
    expect(presetRow?.querySelector('input[name="videoPassword"]')).not.toBeNull();
    expect(presetRow?.querySelector('input[name="ytdlOptionsOverrides"]')).not.toBeNull();
  });

  it('does not submit manual overrides when disabled', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    app.ytdlOptionsOverrides = '{"exec":"echo hi"}';

    const payload = app['buildAddPayload']();

    expect(payload.ytdlOptionsOverrides).toBe('');
  });

  describe('browse a playlist and queue picked entries (#1030)', () => {
    const setup = () => {
      const fixture = TestBed.createComponent(App);
      const app = fixture.componentInstance;
      const toasts = TestBed.inject(ToastService);
      const infoSpy = vi.spyOn(toasts, 'info');
      const errorSpy = vi.spyOn(toasts, 'error');
      const addSpy = vi.spyOn(downloads, 'add');
      app.addUrl = ' https://example.com/playlist ';
      return { app, infoSpy, errorSpy, addSpy };
    };

    it('does nothing when the URL box is empty', () => {
      const { app } = setup();
      app.addUrl = '   ';
      app.browsePlaylist();
      expect(app.browsePayload).toBeNull();
    });

    it('opens the browser with the payload built from the form', () => {
      downloads.configuration['ALLOW_YTDL_OPTIONS_OVERRIDES'] = true;
      const { app } = setup();
      app.playlistItemLimit = 7;
      app.ytdlOptionsPresets = ['Preset A'];
      app.ytdlOptionsOverrides = '{"a":1}';
      app.browsePlaylist();
      expect(app.browsePayload).toEqual({
        url: 'https://example.com/playlist',
        playlistItemLimit: 7,
        ytdlOptionsPresets: ['Preset A'],
        ytdlOptionsOverrides: '{"a":1}',
      });
    });

    it('does not send manual overrides when they are not allowed', () => {
      const { app } = setup();
      app.ytdlOptionsOverrides = '{"exec":"echo hi"}';
      app.browsePlaylist();
      expect(app.browsePayload?.ytdlOptionsOverrides).toBe('');
    });

    it('refuses to open with invalid manual overrides', () => {
      downloads.configuration['ALLOW_YTDL_OPTIONS_OVERRIDES'] = true;
      const { app, errorSpy } = setup();
      app.ytdlOptionsOverrides = '{nope';
      app.browsePlaylist();
      expect(app.browsePayload).toBeNull();
      expect(errorSpy).toHaveBeenCalledWith('Custom yt-dlp options must be valid JSON');
    });

    it('refuses to open when chapter splitting lacks a section number', () => {
      const { app, errorSpy } = setup();
      app.splitByChapters = true;
      app.chapterTemplate = '%(title)s.%(ext)s';
      app.browsePlaylist();
      expect(app.browsePayload).toBeNull();
      expect(errorSpy).toHaveBeenCalledWith('Chapter template must include %(section_number)');
    });

    it('queues each picked url with the form settings, reports once and closes', async () => {
      const { app, addSpy, infoSpy, errorSpy } = setup();
      app.quality = '720';
      app.browsePlaylist();
      app.queueBrowsedEntries(['https://example.com/a', 'https://example.com/b']);
      await vi.waitFor(() => expect(infoSpy).toHaveBeenCalled());
      expect(app.browsePayload).toBeNull();
      expect(addSpy).toHaveBeenCalledTimes(2);
      expect(addSpy.mock.calls.map(([p]) => (p as AddDownloadPayload).url)).toEqual([
        'https://example.com/a',
        'https://example.com/b',
      ]);
      expect((addSpy.mock.calls[0][0] as AddDownloadPayload).quality).toBe('720');
      expect(infoSpy).toHaveBeenCalledTimes(1);
      expect(infoSpy).toHaveBeenCalledWith('Queued 2 items');
      expect(errorSpy).not.toHaveBeenCalled();
      // The URL box is left alone so the user can browse again.
      expect(app.addUrl).toBe(' https://example.com/playlist ');
    });

    it('uses the singular for one item', async () => {
      const { app, infoSpy } = setup();
      app.queueBrowsedEntries(['https://example.com/a']);
      await vi.waitFor(() => expect(infoSpy).toHaveBeenCalledWith('Queued 1 item'));
    });

    it('reports partial failures with counts and the first error', async () => {
      const { app, addSpy, infoSpy, errorSpy } = setup();
      addSpy.mockImplementation(((payload: AddDownloadPayload) =>
        of(
          payload.url.endsWith('/a')
            ? { status: 'ok' }
            : { status: 'error', msg: `bad ${payload.url.slice(-1)}` },
        )) as unknown as typeof downloads.add);
      app.queueBrowsedEntries(['https://example.com/a', 'https://example.com/b', 'https://example.com/c']);
      await vi.waitFor(() => expect(errorSpy).toHaveBeenCalled());
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith('Queued 1 of 3; 2 failed: bad b');
      expect(infoSpy).not.toHaveBeenCalled();
    });

    it('adds nothing when the browser is closed', () => {
      const { app, addSpy, infoSpy, errorSpy } = setup();
      app.browsePlaylist();
      app.closeBrowse();
      expect(app.browsePayload).toBeNull();
      expect(addSpy).not.toHaveBeenCalled();
      expect(infoSpy).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
    });
  });

  it('shows waiting badge for scheduled live stream', () => {
    downloads.queue.set('https://example.com/live', {
      id: 'live1',
      title: 'Upcoming Stream',
      url: 'https://example.com/live',
      download_type: 'video',
      quality: 'best',
      format: 'any',
      folder: '',
      custom_name_prefix: '',
      playlist_item_limit: 0,
      status: 'scheduled',
      live_status: 'is_upcoming',
      live_release_timestamp: Date.now() / 1000 + 3600,
      msg: '',
      percent: 0,
      speed: 0,
      eta: 0,
      filename: '',
      checked: false,
    });
    downloads.queueChanged.next();

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Live in 59m');
  });

  it('Start all starts only the downloads waiting for Start', () => {
    const spy = vi.spyOn(downloads, 'startByFilter');
    const app = TestBed.createComponent(App).componentInstance;
    app.startAllPending();
    const [where, filter] = spy.mock.calls[0] as unknown as [string, (dl: { status: string }) => boolean];
    expect(where).toBe('queue');
    expect(filter({ status: 'pending' })).toBe(true);
    expect(filter({ status: 'queued' })).toBe(false);
    expect(filter({ status: 'downloading' })).toBe(false);
  });

  it('pastes the clipboard into the link field', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { readText: vi.fn().mockResolvedValue('  https://example.com/v  ') },
    });
    const app = TestBed.createComponent(App).componentInstance;
    await app.pasteUrl();
    expect(app.addUrl).toBe('https://example.com/v');
  });

  it('shows the queued format in the Downloading table', () => {
    downloads.queue.set('https://example.com/v', {
      id: 'v1',
      title: 'Some Video',
      url: 'https://example.com/v',
      download_type: 'audio',
      quality: 'best',
      format: 'flac',
      folder: '',
      custom_name_prefix: '',
      playlist_item_limit: 0,
      status: 'downloading',
      msg: '',
      percent: 10,
      speed: 0,
      eta: 0,
      filename: '',
      checked: false,
    });
    downloads.queueChanged.next();

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const row = (fixture.nativeElement as HTMLElement).querySelector('tbody tr');
    expect(row?.textContent).toContain('FLAC');
  });

  it('labels formats the way the form does, and copes with an unknown one', () => {
    const app = TestBed.createComponent(App).componentInstance;
    const base = { format: '' } as Download;

    expect(app.formatLabel({ ...base, format: 'any' })).toBe('Auto');
    expect(app.formatLabel({ ...base, format: 'mp4' })).toBe('MP4');
    expect(app.formatLabel({ ...base, format: 'srt' })).toBe('SRT');
    // A format from a record older than the option list still reads sensibly.
    expect(app.formatLabel({ ...base, format: 'mkv' })).toBe('MKV');
    expect(app.formatLabel(base)).toBe('-');
  });

  describe('download options come from the server catalog', () => {
    const fieldNames = (fixture: { nativeElement: HTMLElement }) =>
      Array.from(
        fixture.nativeElement.querySelectorAll<HTMLElement>(
          ['downloadType', 'codec', 'format', 'quality', 'audioTags', 'subtitleMode']
            .map(name => `hlm-select[name=${name}]`)
            .concat('input#subtitleLanguage')
            .join(','),
        ),
      ).map(el => el.getAttribute('name') ?? el.id);

    // A Spartan select's trigger button: shows the picked option, and is
    // disabled along with the select.
    const select = (fixture: { nativeElement: HTMLElement }, name: string) =>
      fixture.nativeElement.querySelector<HTMLButtonElement>(`hlm-select[name=${name}] [data-slot=select-trigger]`);

    // ngModel writes values and disabled state in a microtask.
    // The tests drive the component's handlers directly, which (unlike a
    // template event) doesn't mark the OnPush view for checking.
    const render = async (fixture: ComponentFixture<App>) => {
      fixture.componentInstance['cdr'].markForCheck();
      fixture.detectChanges();
      await Promise.resolve();
      fixture.detectChanges();
    };

    it('shows no options until the catalog arrives, then restores the remembered choices', async () => {
      downloads.formats = null;
      const cookies = TestBed.inject(CookieService);
      cookies.set('metube_download_type', 'audio');
      cookies.set('metube_format', 'mp3');
      cookies.set('metube_quality', '320');
      const fixture = TestBed.createComponent(App);
      const app = fixture.componentInstance;
      await render(fixture);
      expect(fieldNames(fixture)).toEqual([]);

      downloads.formatsChanged.next(testCatalog());
      await render(fixture);

      expect(fieldNames(fixture)).toEqual(['downloadType', 'format', 'quality', 'audioTags']);
      expect([app.downloadType, app.format, app.quality]).toEqual(['audio', 'mp3', '320']);
      expect(select(fixture, 'format')?.textContent?.trim()).toBe('MP3');
    });

    it('replaces remembered choices the catalog does not offer with its defaults', () => {
      const cookies = TestBed.inject(CookieService);
      cookies.set('metube_download_type', 'audio');
      cookies.set('metube_format', 'ogg');
      cookies.set('metube_quality', '999');
      cookies.set('metube_audio_tags', 'everything');
      cookies.set('metube_subtitle_mode', 'bogus');
      const app = TestBed.createComponent(App).componentInstance;

      expect([app.format, app.quality, app.audioTags, app.subtitleMode])
        .toEqual(['m4a', 'best', 'with_cover', 'prefer_manual']);
      expect(app.subtitleLanguage).toBe('en');

      TestBed.inject(SettingsStore).set('metube_download_type', 'gif');
      expect(TestBed.createComponent(App).componentInstance.downloadType).toBe('video');
    });

    it('keeps a free-form subtitle language the suggestions do not list', () => {
      TestBed.inject(CookieService).set('metube_subtitle_language', 'fil');
      const app = TestBed.createComponent(App).componentInstance;
      expect(app.subtitleLanguage).toBe('fil');
    });

    it('leaves the form alone when the same catalog is resent, and re-checks it when the catalog changes', () => {
      const app = TestBed.createComponent(App).componentInstance;
      // Mid-edit, not yet saved: a reconnect resending the same catalog must
      // not re-apply the remembered choices over it.
      app.quality = '720';

      downloads.formatsChanged.next(testCatalog());
      expect(app.quality).toBe('720');

      const changed = testCatalog();
      const video = changed.download_type.options[0];
      video.format.options = video.format.options.map(f => ({
        ...f,
        quality: { default: 'best', options: [{ id: 'best', text: 'Best' }, { id: '1080', text: '1080p' }] },
      }));
      downloads.formatsChanged.next(changed);
      expect(app.quality).toBe('best');
      expect(app.qualities.map(q => q.id)).toEqual(['best', '1080']);
    });

    it('shows the fields each type carries, in a fixed order', async () => {
      const fixture = TestBed.createComponent(App);
      const app = fixture.componentInstance;
      const expected: Record<string, string[]> = {
        video: ['downloadType', 'codec', 'format', 'quality'],
        audio: ['downloadType', 'format', 'quality', 'audioTags'],
        captions: ['downloadType', 'format', 'subtitleLanguage', 'subtitleMode'],
        thumbnail: ['downloadType', 'format'],
      };
      await render(fixture);
      for (const [type, names] of Object.entries(expected)) {
        app.downloadType = type;
        app.downloadTypeChanged();
        await render(fixture);
        expect(app.downloadType).toBe(type);
        expect(fieldNames(fixture), type).toEqual(names);
      }
      expect(app.optionColumnClass()).toBe('col-span-12 md:col-span-6');
    });

    it('disables a list that has nothing to pick', async () => {
      const fixture = TestBed.createComponent(App);
      const app = fixture.componentInstance;
      app.downloadType = 'audio';
      app.downloadTypeChanged();
      app.format = 'flac';
      app.formatChanged();
      await render(fixture);
      expect(select(fixture, 'quality')?.disabled).toBe(true);

      app.format = 'mp3';
      app.formatChanged();
      await render(fixture);
      expect(select(fixture, 'quality')?.disabled).toBe(false);

      app.downloadType = 'thumbnail';
      app.downloadTypeChanged();
      await render(fixture);
      expect(select(fixture, 'format')?.disabled).toBe(true);
      expect(select(fixture, 'format')?.textContent?.trim()).toBe('JPG');
    });

    it('offers an option added to the catalog without any other change', () => {
      const catalog = testCatalog();
      catalog.download_type.options[1].format.options.push({
        id: 'aac',
        text: 'AAC',
        quality: { default: 'best', options: [{ id: 'best', text: 'Best' }, { id: '256', text: '256 kbps' }] },
        tags: true,
      });
      downloads.formats = catalog;
      const app = TestBed.createComponent(App).componentInstance;
      app.downloadType = 'audio';
      app.downloadTypeChanged();
      app.format = 'aac';
      app.formatChanged();
      app.quality = '256';
      app.qualityChanged();

      expect(app.formatOptions.map(f => f.text)).toContain('AAC');
      expect(app.qualities.map(q => q.text)).toEqual(['Best', '256 kbps']);
      const payload = app['buildAddPayload']();
      expect([payload.downloadType, payload.format, payload.quality]).toEqual(['audio', 'aac', '256']);
    });

    it('labels queued downloads from the catalog, under their own type', () => {
      const app = TestBed.createComponent(App).componentInstance;
      const dl = (fields: Partial<Download>) => ({ format: '', quality: '', ...fields }) as Download;

      expect(app.formatQualityLabel(dl({ download_type: 'video', format: 'any', quality: '1080' }))).toBe('1080p');
      expect(app.formatQualityLabel(dl({ download_type: 'audio', format: 'mp3', quality: '320' }))).toBe('320 kbps');
      expect(app.formatQualityLabel(dl({ download_type: 'captions', format: 'srt', quality: 'best' }))).toBe('-');
      expect(app.formatCodecLabel(dl({ download_type: 'video', codec: 'h265' }))).toBe('H.265 (HEVC)');
      expect(app.formatCodecLabel(dl({ download_type: 'audio', format: 'flac' }))).toBe('FLAC');
      expect(app.downloadTypeLabel(dl({ download_type: 'captions' }))).toBe('Captions');
      expect(app.formatLabel(dl({ download_type: 'audio', format: 'auto' }))).toBe('Auto');
      expect(app.formatLabel(dl({ download_type: 'captions', format: 'dfxp' }))).toBe('DFXP');
    });
  });

  describe('audio Auto format and Tags dropdown', () => {
    it('lists Auto first but still defaults a switch to Audio to M4A', () => {
      const app = TestBed.createComponent(App).componentInstance;

      app.downloadType = 'audio';
      app.downloadTypeChanged();

      expect(app.formatOptions[0].id).toBe('auto');
      expect(app.format).toBe('m4a');
    });

    it('sends the remembered Tags choice with the download', () => {
      const cookies = TestBed.inject(CookieService);
      cookies.set('metube_audio_tags', 'none');
      const app = TestBed.createComponent(App).componentInstance;

      expect(app['buildAddPayload']().audioTags).toBe('none');
    });

    it('falls back to With cover for an unknown remembered choice', () => {
      TestBed.inject(CookieService).set('metube_audio_tags', 'everything');
      const app = TestBed.createComponent(App).componentInstance;

      expect(app.audioTags).toBe('with_cover');
    });

    it('shows None, disabled, for WAV without forgetting the choice', async () => {
      const fixture = TestBed.createComponent(App);
      const app = fixture.componentInstance;
      app.downloadType = 'audio';
      app.downloadTypeChanged();
      app.audioTagsChanged('no_cover');
      app.format = 'wav';
      app.formatChanged();
      fixture.detectChanges();
      // ngModel writes the value and disabled state in a microtask.
      await Promise.resolve();
      fixture.detectChanges();

      const trigger = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
        'hlm-select[name=audioTags] [data-slot=select-trigger]',
      );
      expect(trigger?.disabled).toBe(true);
      expect(trigger?.textContent?.trim()).toBe('None');

      app.format = 'mp3';
      app.formatChanged();
      expect(app.displayedAudioTags()).toBe('no_cover');
    });
  });

  it('includes titleRegex in subscribe payload', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    const subs = TestBed.inject(SubscriptionsService) as unknown as SubscriptionsServiceStub;
    app.addUrl = 'https://example.com/channel';
    app.titleRegex = 'EPISODE';
    app.addSubscription();
    expect(subs.subscribeCalls.length).toBe(1);
    const payload = subs.subscribeCalls[0] as { titleRegex: string; skipSubscriberOnly: boolean };
    expect(payload.titleRegex).toBe('EPISODE');
    expect(payload.skipSubscriberOnly).toBe(false);
  });

  it('includes skipSubscriberOnly true when checked', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    const subs = TestBed.inject(SubscriptionsService) as unknown as SubscriptionsServiceStub;
    app.addUrl = 'https://example.com/channel';
    app.skipSubscriberOnly = true;
    app.addSubscription();
    expect(subs.subscribeCalls.length).toBe(1);
    const payload = subs.subscribeCalls[0] as { skipSubscriberOnly: boolean };
    expect(payload.skipSubscriberOnly).toBe(true);
  });

  it('passes clip fields through to the subscribe payload', () => {
    // #1049: a subscription's options apply to all its future downloads, and
    // clip bounds used to be stripped out on the way.
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    const subs = TestBed.inject(SubscriptionsService) as unknown as SubscriptionsServiceStub;
    app.addUrl = 'https://example.com/channel';
    app.clipStart = '1:00';
    app.clipEnd = '2:00';
    app.addSubscription();
    expect(subs.subscribeCalls.length).toBe(1);
    const payload = subs.subscribeCalls[0] as Record<string, unknown>;
    expect(payload['clipStart']).toBe('1:00');
    expect(payload['clipEnd']).toBe('2:00');
  });

  it('buildAddPayload includes clip times', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.clipStart = '0:10';
    app.clipEnd = '1:20';
    const payload = app['buildAddPayload']();
    expect(payload.clipStart).toBe('0:10');
    expect(payload.clipEnd).toBe('1:20');
  });

  it('retries a failed download by its server-side queue id', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    const download = {
      id: 'vid1',
      title: 'Test Video',
      url: 'https://example.com/v',
      download_type: 'video',
      quality: 'best',
      format: 'any',
      folder: '',
      custom_name_prefix: '',
      playlist_item_limit: 0,
      status: 'error',
      msg: 'temporary failure',
      percent: 0,
      speed: 0,
      eta: 0,
      filename: '',
      checked: false,
    };

    app.retryDownload(download.url, download);

    expect(downloads.retryCalls).toEqual([download.url]);
  });

  it('blocks subscribe with invalid title regex', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    const subs = TestBed.inject(SubscriptionsService) as unknown as SubscriptionsServiceStub;
    app.addUrl = 'https://example.com/channel';
    app.titleRegex = '[';
    app.addSubscription();
    expect(subs.subscribeCalls.length).toBe(0);
    // Reported on the title filter itself, not on the URL, with the reason.
    expect(app.titleRegexError).toMatch(/^This isn't a valid regular expression: .+\.$/);
    expect(app.addError).toBeNull();
  });

  describe('URL bar', () => {
    it('stops an empty link in the browser, with the reason under the bar', () => {
      const fixture = TestBed.createComponent(App);
      const app = fixture.componentInstance;
      const addSpy = vi.spyOn(downloads, 'add');
      app.addUrl = '   ';

      app.submitAdd();

      expect(addSpy).not.toHaveBeenCalled();
      expect(app.addError).toBe('Paste a link first.');
    });

    it("shows yt-dlp's error under the bar without its log prefix", () => {
      const fixture = TestBed.createComponent(App);
      const app = fixture.componentInstance;
      vi.spyOn(downloads, 'add').mockReturnValue(
        of({ status: 'error', msg: "ERROR: [generic] 'nope' is not a valid URL" }) as never,
      );
      app.addUrl = 'nope';

      app.submitAdd();

      expect(app.addError).toBe("'nope' is not a valid URL.");
      expect(app.addUrl).toBe('nope');
      expect(app.addInProgress).toBe(false);
    });

    it('keeps a link typed while the previous one was still being added', () => {
      const fixture = TestBed.createComponent(App);
      const app = fixture.componentInstance;
      const response = new Subject<{ status: 'ok' }>();
      vi.spyOn(downloads, 'add').mockReturnValue(response as never);
      app.addUrl = 'https://example.com/first';

      app.submitAdd();
      app.addUrl = 'https://example.com/second';
      response.next({ status: 'ok' });

      expect(app.addUrl).toBe('https://example.com/second');
    });

    it('says a rejected link was kept in Failed once its row arrives', () => {
      const fixture = TestBed.createComponent(App);
      const app = fixture.componentInstance;
      vi.spyOn(downloads, 'add').mockReturnValue(
        of({ status: 'error', msg: "ERROR: [generic] 'nope' is not a valid URL" }) as never,
      );
      app.addUrl = 'nope';

      app.submitAdd();
      expect(app.addErrorKeptInFailed).toBe(false);

      // The Failed row comes over the socket just after the HTTP reply.
      downloads.done.set('nope', { url: 'nope', status: 'error' });
      downloads.doneChanged.next();
      expect(app.addErrorKeptInFailed).toBe(true);

      // Editing the link clears both the error and the note.
      app.clearAddError();
      expect(app.addErrorKeptInFailed).toBe(false);
    });

    it('does not mention Failed when the server recorded nothing', () => {
      const fixture = TestBed.createComponent(App);
      const app = fixture.componentInstance;
      vi.spyOn(downloads, 'add').mockReturnValue(
        of({ status: 'error', msg: 'Nothing to add' }) as never,
      );
      app.addUrl = 'https://example.com/empty';

      app.submitAdd();
      downloads.doneChanged.next();

      expect(app.addError).toBe('Nothing to add.');
      expect(app.addErrorKeptInFailed).toBe(false);
    });

    it('opens Subscribe mode from the Subscriptions empty state', () => {
      // jsdom doesn't implement scrolling.
      const scroll = vi.fn();
      Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { value: scroll, configurable: true });
      const fixture = TestBed.createComponent(App);
      const app = fixture.componentInstance;
      app.setListView('subscriptions');
      fixture.detectChanges();

      const button = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'))
        .find(b => b.textContent?.includes('Subscribe to a channel'));
      button!.click();

      expect(app.addMode).toBe('subscribe');
      expect(scroll).toHaveBeenCalled();
      delete (HTMLElement.prototype as { scrollIntoView?: unknown }).scrollIntoView;
    });

    it('keeps the bar usable while a link is being added', () => {
      const fixture = TestBed.createComponent(App);
      const app = fixture.componentInstance;
      vi.spyOn(downloads, 'add').mockReturnValue(new Subject() as never);
      app.addUrl = 'https://example.com/slow-playlist';
      app.submitAdd();
      fixture.detectChanges();

      const root = fixture.nativeElement as HTMLElement;
      const bar = root.querySelector('[data-add-bar]')!;
      const main = bar.querySelector<HTMLButtonElement>('button[type=submit]')!;
      expect(bar.getAttribute('aria-busy')).toBe('true');
      expect(main.textContent).toContain('Adding');
      // Readable and focusable, not greyed out by `disabled`.
      expect(main.disabled).toBe(false);
      expect(main.getAttribute('aria-disabled')).toBe('true');
      expect(bar.querySelector<HTMLInputElement>('input[aria-label^="Video"]')!.disabled).toBe(false);
      // Cancel is a neutral icon in the menu slot, not a second red button.
      expect(bar.querySelector('button[aria-label="Cancel adding this link"]')).not.toBeNull();
      // The mode menu gives its slot to Cancel, so the mode can't change mid-add.
      expect(Array.from(bar.querySelectorAll('button')).some(b => b.textContent?.includes('Subscribe'))).toBe(false);
    });

    it('releases the bar as soon as a subscription is sent', () => {
      const fixture = TestBed.createComponent(App);
      const app = fixture.componentInstance;
      const subs = TestBed.inject(SubscriptionsService) as unknown as SubscriptionsServiceStub;
      const response = new Subject<{ status: 'ok' }>();
      vi.spyOn(subs, 'subscribe').mockReturnValue(response as never);
      app.addUrl = 'https://example.com/channel';
      app.setAddMode('subscribe');

      app.submitAdd();

      // Back to Download with an empty field while the server reads the channel.
      expect(app.pendingSubscription).toEqual({ url: 'https://example.com/channel' });
      expect(app.addMode).toBe('download');
      expect(app.addUrl).toBe('');

      // Download works in the meantime.
      const addSpy = vi.spyOn(downloads, 'add');
      app.addUrl = 'https://example.com/video';
      app.submitAdd();
      expect(addSpy).toHaveBeenCalled();

      response.next({ status: 'ok' });
      response.complete();
      expect(app.pendingSubscription).toBeNull();
      // The user may be busy elsewhere; the view doesn't jump.
      expect(app.listView).toBe('downloading');
    });

    it('puts a failed subscription back in the bar with its settings', () => {
      const fixture = TestBed.createComponent(App);
      const app = fixture.componentInstance;
      const subs = TestBed.inject(SubscriptionsService) as unknown as SubscriptionsServiceStub;
      vi.spyOn(subs, 'subscribe').mockReturnValue(
        of({ status: 'error', msg: 'ERROR: [youtube] Channel does not exist' }) as never,
      );
      app.addUrl = 'https://example.com/channel';
      app.titleRegex = 'EPISODE';
      app.setAddMode('subscribe');

      app.submitAdd();

      expect(app.addUrl).toBe('https://example.com/channel');
      expect(app.addMode).toBe('subscribe');
      expect(app.titleRegex).toBe('EPISODE');
      expect(app.addError).toBe('Channel does not exist.');
    });

    it('lets only one subscription be set up at a time', () => {
      const fixture = TestBed.createComponent(App);
      const app = fixture.componentInstance;
      const subs = TestBed.inject(SubscriptionsService) as unknown as SubscriptionsServiceStub;
      const spy = vi.spyOn(subs, 'subscribe').mockReturnValue(new Subject() as never);
      app.setAddMode('subscribe');
      app.addUrl = 'https://example.com/one';
      app.submitAdd();

      app.setAddMode('subscribe');
      app.addUrl = 'https://example.com/two';
      app.submitAdd();

      expect(spy).toHaveBeenCalledTimes(1);
      expect(app.addError).toContain('Another subscription');
      expect(app.addUrl).toBe('https://example.com/two');
    });

    it('fills the URL field from a paste anywhere on the page', () => {
      const fixture = TestBed.createComponent(App);
      fixture.detectChanges();
      const app = fixture.componentInstance;
      const event = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent;
      Object.defineProperty(event, 'clipboardData', {
        value: { getData: () => '  https://example.com/pasted  ' },
      });

      document.body.dispatchEvent(event);

      expect(app.addUrl).toBe('https://example.com/pasted');
      expect(event.defaultPrevented).toBe(true);
    });

    it('leaves pastes into other fields alone', () => {
      const fixture = TestBed.createComponent(App);
      fixture.detectChanges();
      const app = fixture.componentInstance;
      app.addUrl = '';
      const other = document.createElement('textarea');
      document.body.appendChild(other);
      const event = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent;
      Object.defineProperty(event, 'clipboardData', { value: { getData: () => 'hello' } });

      other.dispatchEvent(event);

      expect(app.addUrl).toBe('');
      other.remove();
    });
  });

  it('regexErrorMessage keeps the browser\'s reason and drops the pattern', () => {
    expect(regexErrorMessage(new SyntaxError('Invalid regular expression: /[/: Unterminated character class')))
      .toBe("This isn't a valid regular expression: unterminated character class.");
    expect(regexErrorMessage('weird')).toBe("This isn't a valid regular expression.");
  });

  it('plainAddError drops the yt-dlp level and extractor prefix', () => {
    expect(plainAddError('ERROR: [youtube] abc: Video unavailable')).toBe('abc: Video unavailable.');
    expect(plainAddError(
      'ERROR: [generic] clip: Unable to download webpage: HTTP Error 404: Not Found (caused by <HTTPError 404: Not Found>)',
    )).toBe('clip: Unable to download webpage: HTTP Error 404: Not Found.');
    expect(plainAddError('Already in queue!')).toBe('Already in queue!');
    expect(plainAddError(undefined)).toBe('');
  });

  it('renames a subscription and closes the inline editor', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    const subs = TestBed.inject(SubscriptionsService) as unknown as SubscriptionsServiceStub;

    app.beginEditName('sub1', 'Videos');
    expect(app.editingNameId).toBe('sub1');
    expect(app.nameEditDraft).toBe('Videos');

    app.nameEditDraft = '  Jane uploads  ';
    app.saveName('sub1');

    expect(subs.updateCalls).toEqual([['sub1', { name: 'Jane uploads' }]]);
    expect(app.editingNameId).toBeNull();
  });

  it('blocks renaming a subscription to an empty name', () => {
    const toasts = TestBed.inject(ToastService);
    const errorSpy = vi.spyOn(toasts, 'error').mockImplementation(() => undefined);
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    const subs = TestBed.inject(SubscriptionsService) as unknown as SubscriptionsServiceStub;

    app.beginEditName('sub1', 'Videos');
    app.nameEditDraft = '   ';
    app.saveName('sub1');

    expect(subs.updateCalls.length).toBe(0);
    expect(app.editingNameId).toBe('sub1');
    expect(errorSpy).toHaveBeenCalledWith('Subscription name must not be empty');
    errorSpy.mockRestore();
  });
  // Issue #533: the server picks AUDIO_DOWNLOAD_DIR on download_type alone
  // (ytdl.py), so the UI's choice of URL base has to use the same rule. It used
  // to also treat any .mp3 as audio, which pointed the link at audio_download/
  // for files the server had written to DOWNLOAD_DIR.
  describe('download links follow the server directory rule (#533)', () => {
    const makeDownload = (over: Partial<Download>): Download => ({
      id: 'vid1',
      title: 'Test',
      url: 'https://example.com/v',
      download_type: 'video',
      quality: 'best',
      format: 'any',
      folder: '',
      custom_name_prefix: '',
      playlist_item_limit: 0,
      status: 'finished',
      msg: '',
      percent: 100,
      speed: 0,
      eta: 0,
      filename: 'song.mp4',
      checked: false,
      ...over,
    } as Download);

    const appWithDirs = () => {
      const fixture = TestBed.createComponent(App);
      const app = fixture.componentInstance;
      const downloads = TestBed.inject(DownloadsService) as unknown as DownloadsServiceStub;
      downloads.configuration['PUBLIC_HOST_URL'] = 'download/';
      downloads.configuration['PUBLIC_HOST_AUDIO_URL'] = 'audio_download/';
      return app;
    };

    it('uses the audio base for an audio download', () => {
      const app = appWithDirs();
      const link = app.buildDownloadLink(makeDownload({ download_type: 'audio', filename: 'song.mp3' }));
      expect(link).toBe('audio_download/song.mp3');
    });

    it('uses the video base for an mp3 produced by a video download', () => {
      const app = appWithDirs();
      const link = app.buildDownloadLink(makeDownload({ download_type: 'video', filename: 'song.mp3' }));
      expect(link).toBe('download/song.mp3');
    });

    it('uses the video base for a video download', () => {
      const app = appWithDirs();
      const link = app.buildDownloadLink(makeDownload({ filename: 'clip.mp4' }));
      expect(link).toBe('download/clip.mp4');
    });

    it('applies the same rule to chapter links', () => {
      const app = appWithDirs();
      const dl = makeDownload({ download_type: 'video' });
      expect(app.buildChapterDownloadLink(dl, 'ch1.mp3')).toBe('download/ch1.mp3');
      const audio = makeDownload({ download_type: 'audio' });
      expect(app.buildChapterDownloadLink(audio, 'ch1.mp3')).toBe('audio_download/ch1.mp3');
    });
  });

  // Issue #424: ffmpeg work after the bytes land (merge, re-encode, split) used
  // to leave the row on a full, frozen bar with the item counted as neither
  // active nor queued.
  describe('post-processing is visible (#424)', () => {
    const queueEntry = (status: string): Download => ({
      id: 'vid1',
      title: 'Test',
      url: 'https://example.com/v',
      download_type: 'video',
      quality: 'best',
      format: 'any',
      folder: '',
      custom_name_prefix: '',
      playlist_item_limit: 0,
      status,
      msg: '',
      percent: 100,
      speed: 0,
      eta: 0,
      filename: '',
      checked: false,
    } as Download);

    it('runs the bar indeterminate while preparing or post-processing', () => {
      const app = TestBed.createComponent(App).componentInstance;
      expect(app.isIndeterminate(queueEntry('preparing'))).toBe(true);
      expect(app.isIndeterminate(queueEntry('postprocessing'))).toBe(true);
      expect(app.isIndeterminate(queueEntry('downloading'))).toBe(false);
      expect(app.isIndeterminate(queueEntry('pending'))).toBe(false);
    });

    it('labels the bar and counts the item as active', () => {
      // The component subscribes to queueChanged on construction, so the entry
      // has to be announced after it exists or updateQueueMetrics never runs.
      const fixture = TestBed.createComponent(App);
      downloads.queue.set('https://example.com/v', queueEntry('postprocessing'));
      downloads.queueChanged.next();
      fixture.detectChanges();

      expect((fixture.nativeElement as HTMLElement).textContent).toContain('Post-processing');
      expect(fixture.componentInstance.activeDownloads).toBe(1);
      expect(fixture.componentInstance.queuedDownloads).toBe(0);
    });
  });

  // Issue #1081: a download waiting for a concurrency slot ('queued') starts on
  // its own, so it must not offer the Start button that a 'pending' row — one
  // added with auto-start off — legitimately has.
  describe('queued rows do not offer a dead Start button (#1081)', () => {
    const queueEntry = (status: string): Download => ({
      id: 'vid1',
      title: 'Test',
      url: 'https://example.com/v',
      download_type: 'video',
      quality: 'best',
      format: 'any',
      folder: '',
      custom_name_prefix: '',
      playlist_item_limit: 0,
      status,
      msg: '',
      percent: 0,
      speed: 0,
      eta: 0,
      filename: '',
      checked: false,
    } as Download);

    const render = (status: string) => {
      const fixture = TestBed.createComponent(App);
      downloads.queue.set('https://example.com/v', queueEntry(status));
      downloads.queueChanged.next();
      fixture.detectChanges();
      return fixture;
    };

    it('hides Start for a queued row but keeps it for a pending one', () => {
      const queued = render('queued');
      expect(
        (queued.nativeElement as HTMLElement).querySelector('[aria-label="Start download for Test"]')
      ).toBeNull();

      downloads.queue.clear();

      const pending = render('pending');
      expect(
        (pending.nativeElement as HTMLElement).querySelector('[aria-label="Start download for Test"]')
      ).not.toBeNull();
    });

    // Pending has one Start, in the bar's slot: the actions column scrolls out
    // of view on a phone, and a second button there would be redundant.
    it('starts a pending row from the slot that shows its state', () => {
      const fixture = render('pending');
      const root = fixture.nativeElement as HTMLElement;
      const starts = root.querySelectorAll<HTMLButtonElement>('[aria-label="Start download for Test"]');
      expect(starts.length).toBe(1);
      expect(starts[0].textContent).toContain('Auto-start off');

      const startSpy = vi.spyOn(downloads, 'startById');
      starts[0].click();
      expect(startSpy).toHaveBeenCalledWith(['https://example.com/v']);
    });

    it('says why the row is idle and counts it as queued', () => {
      const fixture = render('queued');
      const root = fixture.nativeElement as HTMLElement;
      expect(root.textContent).toContain('Queued for a slot');
      expect(root.querySelector('hlm-progress')).toBeNull();
      expect(fixture.componentInstance.queuedDownloads).toBe(1);
      expect(fixture.componentInstance.activeDownloads).toBe(0);
    });
  });

  // Issue #1012: in ask mode (DELETE_FILE_ON_TRASHCAN='ask') the server only
  // deletes a completed download's file when told to, so the UI must ask the
  // user whether to keep or delete it before removing the list entry.
  describe('Clear failed asks first (#1094)', () => {
    const failed = (url: string) => ({
      id: url, title: url, url, quality: 'best', format: 'any', folder: '', custom_name_prefix: '',
      playlist_item_limit: 0, status: 'error', msg: 'boom', percent: 0, speed: 0, eta: 0,
      filename: '', checked: false,
    }) as Download;

    it('clears nothing when cancelled', async () => {
      downloads.done.set('u1', failed('u1'));
      const app = TestBed.createComponent(App).componentInstance;
      vi.spyOn(TestBed.inject(ToastService), 'confirm').mockResolvedValue(false);
      const delSpy = vi.spyOn(downloads, 'delById');

      await app.clearFailedDownloads();

      expect(delSpy).not.toHaveBeenCalled();
    });

    it('clears every failed row, and only those, when confirmed', async () => {
      downloads.done.set('u1', failed('u1'));
      downloads.done.set('u2', failed('u2'));
      downloads.done.set('ok', { ...failed('ok'), status: 'finished' });
      const app = TestBed.createComponent(App).componentInstance;
      const confirmSpy = vi.spyOn(TestBed.inject(ToastService), 'confirm').mockResolvedValue(true);
      const delSpy = vi.spyOn(downloads, 'delById');

      await app.clearFailedDownloads();

      expect(confirmSpy).toHaveBeenCalledWith(
        'Clear 2 failed downloads? Their URLs are not kept anywhere else, so retrying later means finding them again.',
        'Clear',
        'Cancel',
      );
      expect(delSpy).toHaveBeenCalledWith('done', ['u1', 'u2'], undefined);
    });

    it('words the question for a single row', async () => {
      downloads.done.set('u1', failed('u1'));
      const app = TestBed.createComponent(App).componentInstance;
      const confirmSpy = vi.spyOn(TestBed.inject(ToastService), 'confirm').mockResolvedValue(false);

      await app.clearFailedDownloads();

      expect(confirmSpy.mock.calls[0][0]).toMatch(/^Clear the failed download\? Its URL is not kept/);
    });

    it('asks nothing when there is nothing to clear', async () => {
      const app = TestBed.createComponent(App).componentInstance;
      const confirmSpy = vi.spyOn(TestBed.inject(ToastService), 'confirm');

      await app.clearFailedDownloads();

      expect(confirmSpy).not.toHaveBeenCalled();
    });

    it('leaves Clear completed unprompted', async () => {
      downloads.done.set('ok', { ...failed('ok'), status: 'finished' });
      const app = TestBed.createComponent(App).componentInstance;
      const confirmSpy = vi.spyOn(TestBed.inject(ToastService), 'confirm');
      const delSpy = vi.spyOn(downloads, 'delById');

      await app.clearCompletedDownloads();

      expect(confirmSpy).not.toHaveBeenCalled();
      expect(delSpy).toHaveBeenCalledWith('done', ['ok'], undefined);
    });
  });

  describe('delete confirmation in ask mode (#1012)', () => {
    const doneEntry = (over: Partial<Download>): Download => ({
      id: 'vid1',
      title: 'Test Video',
      url: 'u1',
      download_type: 'video',
      quality: 'best',
      format: 'any',
      folder: '',
      custom_name_prefix: '',
      playlist_item_limit: 0,
      status: 'finished',
      msg: '',
      percent: 100,
      speed: 0,
      eta: 0,
      filename: 'video.mp4',
      checked: false,
      ...over,
    } as Download);

    it('prompts and forwards "Delete files" (true) to delById', async () => {
      downloads.configuration['DELETE_FILE_ON_TRASHCAN'] = 'ask';
      downloads.done.set('u1', doneEntry({ url: 'u1' }));
      const fixture = TestBed.createComponent(App);
      const app = fixture.componentInstance;
      const toasts = TestBed.inject(ToastService);
      const chooseSpy = vi.spyOn(toasts, 'choose').mockResolvedValue(true);
      const delSpy = vi.spyOn(downloads, 'delById');

      await app.delDownload('done', 'u1');

      expect(chooseSpy).toHaveBeenCalledTimes(1);
      expect(delSpy).toHaveBeenCalledWith('done', ['u1'], true);
    });

    it('prompts and forwards "Remove from list" (false) to delById', async () => {
      downloads.configuration['DELETE_FILE_ON_TRASHCAN'] = 'ask';
      downloads.done.set('u1', doneEntry({ url: 'u1' }));
      const fixture = TestBed.createComponent(App);
      const app = fixture.componentInstance;
      const toasts = TestBed.inject(ToastService);
      vi.spyOn(toasts, 'choose').mockResolvedValue(false);
      const delSpy = vi.spyOn(downloads, 'delById');

      await app.delDownload('done', 'u1');

      expect(delSpy).toHaveBeenCalledWith('done', ['u1'], false);
    });

    it('does not call delById when the prompt is cancelled', async () => {
      downloads.configuration['DELETE_FILE_ON_TRASHCAN'] = 'ask';
      downloads.done.set('u1', doneEntry({ url: 'u1' }));
      const fixture = TestBed.createComponent(App);
      const app = fixture.componentInstance;
      const toasts = TestBed.inject(ToastService);
      vi.spyOn(toasts, 'choose').mockResolvedValue(null);
      const delSpy = vi.spyOn(downloads, 'delById');

      await app.delDownload('done', 'u1');

      expect(delSpy).not.toHaveBeenCalled();
    });

    it('does not prompt when DELETE_FILE_ON_TRASHCAN is "true"', async () => {
      downloads.configuration['DELETE_FILE_ON_TRASHCAN'] = 'true';
      downloads.done.set('u1', doneEntry({ url: 'u1' }));
      const fixture = TestBed.createComponent(App);
      const app = fixture.componentInstance;
      const toasts = TestBed.inject(ToastService);
      const chooseSpy = vi.spyOn(toasts, 'choose');
      const delSpy = vi.spyOn(downloads, 'delById');

      await app.delDownload('done', 'u1');

      expect(chooseSpy).not.toHaveBeenCalled();
      expect(delSpy).toHaveBeenCalledWith('done', ['u1'], undefined);
    });

    it('does not prompt when DELETE_FILE_ON_TRASHCAN is "false"', async () => {
      downloads.configuration['DELETE_FILE_ON_TRASHCAN'] = 'false';
      downloads.done.set('u1', doneEntry({ url: 'u1' }));
      const fixture = TestBed.createComponent(App);
      const app = fixture.componentInstance;
      const toasts = TestBed.inject(ToastService);
      const chooseSpy = vi.spyOn(toasts, 'choose');
      const delSpy = vi.spyOn(downloads, 'delById');

      await app.delDownload('done', 'u1');

      expect(chooseSpy).not.toHaveBeenCalled();
      expect(delSpy).toHaveBeenCalledWith('done', ['u1'], undefined);
    });

    it('does not prompt for entries with nothing on disk (e.g. clearFailedDownloads)', async () => {
      downloads.configuration['DELETE_FILE_ON_TRASHCAN'] = 'ask';
      downloads.done.set('u1', doneEntry({ url: 'u1', status: 'error', filename: '' }));
      const fixture = TestBed.createComponent(App);
      const app = fixture.componentInstance;
      const toasts = TestBed.inject(ToastService);
      // Clear failed's own confirmation (#1094), answered yes.
      const confirmSpy = vi.spyOn(toasts, 'confirm').mockResolvedValue(true);
      const chooseSpy = vi.spyOn(toasts, 'choose');
      const delSpy = vi.spyOn(downloads, 'delById');

      await app.clearFailedDownloads();

      expect(confirmSpy).toHaveBeenCalledTimes(1);
      expect(chooseSpy).not.toHaveBeenCalled();
      expect(delSpy).toHaveBeenCalledWith('done', ['u1'], false);
    });

    it('prompts when a failed chapter-split download left chapter files behind', async () => {
      downloads.configuration['DELETE_FILE_ON_TRASHCAN'] = 'ask';
      downloads.done.set('u1', doneEntry({
        url: 'u1',
        status: 'error',
        filename: '',
        chapter_files: [{ filename: 'ch1.mp4', size: 1 }],
      }));
      const fixture = TestBed.createComponent(App);
      const app = fixture.componentInstance;
      const toasts = TestBed.inject(ToastService);
      const confirmSpy = vi.spyOn(toasts, 'confirm');
      const chooseSpy = vi.spyOn(toasts, 'choose').mockResolvedValue(true);
      const delSpy = vi.spyOn(downloads, 'delById');

      await app.clearFailedDownloads();

      // The file prompt has Cancel, so it is the only question asked.
      expect(confirmSpy).not.toHaveBeenCalled();
      expect(chooseSpy).toHaveBeenCalledTimes(1);
      expect(delSpy).toHaveBeenCalledWith('done', ['u1'], true);
    });

    it('does not prompt for queue deletions', async () => {
      downloads.configuration['DELETE_FILE_ON_TRASHCAN'] = 'ask';
      downloads.queue.set('u1', doneEntry({ url: 'u1', status: 'downloading' }));
      const fixture = TestBed.createComponent(App);
      const app = fixture.componentInstance;
      const toasts = TestBed.inject(ToastService);
      const chooseSpy = vi.spyOn(toasts, 'choose');
      const delSpy = vi.spyOn(downloads, 'delById');

      await app.delDownload('queue', 'u1');

      expect(chooseSpy).not.toHaveBeenCalled();
      expect(delSpy).toHaveBeenCalledWith('queue', ['u1'], undefined);
    });

    it('retryDownload does not prompt even in ask mode, and sends no flag', () => {
      downloads.configuration['DELETE_FILE_ON_TRASHCAN'] = 'ask';
      const fixture = TestBed.createComponent(App);
      const app = fixture.componentInstance;
      const toasts = TestBed.inject(ToastService);
      const chooseSpy = vi.spyOn(toasts, 'choose');
      const delSpy = vi.spyOn(downloads, 'delById');
      const download = doneEntry({ url: 'u1', status: 'error' });

      app.retryDownload('u1', download);

      expect(chooseSpy).not.toHaveBeenCalled();
      expect(delSpy).toHaveBeenCalledWith('done', ['u1']);
    });

    it('prompts once with a count for multiple completed entries', async () => {
      downloads.configuration['DELETE_FILE_ON_TRASHCAN'] = 'ask';
      downloads.done.set('u1', doneEntry({ url: 'u1' }));
      downloads.done.set('u2', doneEntry({ url: 'u2', title: 'Second video' }));
      const fixture = TestBed.createComponent(App);
      const app = fixture.componentInstance;
      const toasts = TestBed.inject(ToastService);
      const chooseSpy = vi.spyOn(toasts, 'choose').mockResolvedValue(true);
      const delSpy = vi.spyOn(downloads, 'delById');

      await app.clearCompletedDownloads();

      expect(chooseSpy).toHaveBeenCalledTimes(1);
      expect(chooseSpy.mock.calls[0][0]).toContain('2 items');
      expect(delSpy).toHaveBeenCalledTimes(1);
      expect(delSpy).toHaveBeenCalledWith('done', ['u1', 'u2'], true);
    });
  });

  // A progress tick replaces one queue object and nothing else. It used to
  // re-render every row on the page, so with a long history each tick cost
  // tens of milliseconds and a few concurrent downloads froze the UI.
  describe('progress ticks re-render only the row that changed', () => {
    const entry = (url: string, status: string, extra: Partial<Download> = {}): Download => ({
      id: url,
      title: url,
      url,
      download_type: 'video',
      quality: 'best',
      format: 'any',
      folder: '',
      custom_name_prefix: '',
      playlist_item_limit: 0,
      status,
      msg: '',
      percent: 0,
      speed: 0,
      eta: 0,
      filename: '',
      checked: false,
      ...extra,
    } as Download);

    it('leaves completed entries and other queue rows alone', () => {
      downloads.configuration['PUBLIC_HOST_URL'] = 'download/';
      downloads.done.set('d1', entry('d1', 'finished', { filename: 'd1.mp4' }));
      downloads.queue.set('q1', entry('q1', 'downloading'));
      downloads.queue.set('q2', entry('q2', 'downloading'));
      const fixture = TestBed.createComponent(App);
      downloads.queueChanged.next();
      downloads.doneChanged.next();
      fixture.detectChanges();

      const doneRender = vi.spyOn(DoneEntryComponent.prototype, 'link');
      const queueRender = vi.spyOn(DownloadRowComponent.prototype, 'indeterminate');
      downloads.queue.set('q1', entry('q1', 'downloading', { percent: 50 }));
      downloads.updated.next();
      fixture.detectChanges();

      expect(doneRender).not.toHaveBeenCalled();
      // Only the row that changed renders; q2 is skipped.
      const rendered = new Set(queueRender.mock.contexts.map(c => (c as DownloadRowComponent).id()));
      expect([...rendered]).toEqual(['q1']);
      expect((fixture.nativeElement as HTMLElement).textContent).toContain('50%');
    });

    it('still re-renders a completed entry when its selection changes in place', () => {
      downloads.configuration['PUBLIC_HOST_URL'] = 'download/';
      const done = entry('d1', 'finished', { filename: 'd1.mp4' });
      downloads.done.set('d1', done);
      const fixture = TestBed.createComponent(App);
      fixture.componentInstance.setListView('completed');
      downloads.doneChanged.next();
      fixture.detectChanges();

      const doneRender = vi.spyOn(DoneEntryComponent.prototype, 'link');
      // Select-all mutates the shared object rather than replacing it.
      done.checked = true;
      fixture.componentRef.injector.get(ChangeDetectorRef).markForCheck();
      fixture.detectChanges();

      expect(doneRender).toHaveBeenCalled();
    });
  });

});

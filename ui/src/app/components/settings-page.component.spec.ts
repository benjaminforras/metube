import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';
import { SettingsPageComponent } from './settings-page.component';
import { DefaultsService, DownloadsService, ToastService } from '../services';
import { FormDefaults, FormatCatalog } from '../interfaces';

function formDefaults(overrides: Partial<FormDefaults> = {}): FormDefaults {
  return {
    download_type: 'video',
    video: { codec: 'auto', format: 'any', quality: 'best' },
    audio: { format: 'mp3', quality: '320' },
    captions: { format: 'srt', subtitle_language: 'en', subtitle_mode: 'prefer_manual' },
    audio_tags: 'with_cover',
    folder: '',
    custom_name_prefix: '',
    auto_start: true,
    playlist_item_limit: 0,
    sponsorblock: false,
    split_by_chapters: false,
    chapter_template: '%(title)s.%(ext)s',
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
  saved: FormDefaults[] = [];
  save(values: FormDefaults) {
    this.saved.push(structuredClone(values));
    this.defaults.set(structuredClone(values));
    return of(structuredClone(values));
  }
  reset() {
    const values = formDefaults();
    this.defaults.set(values);
    return of(values);
  }
}

const choice = (def: string, ...ids: string[]) => ({
  default: def,
  options: ids.map(id => ({ id, text: id.toUpperCase() })),
});

// A trimmed-down catalog in the shape app/format_catalog.py sends.
function testCatalog(): FormatCatalog {
  const videoQuality = choice('best', 'best', '1080', '720');
  return {
    download_type: {
      default: 'video',
      options: [
        {
          id: 'video', text: 'Video',
          codec: choice('auto', 'auto', 'h264'),
          format: { default: 'any', options: [{ id: 'any', text: 'Auto', quality: videoQuality }] },
        },
        {
          id: 'audio', text: 'Audio',
          format: {
            default: 'm4a',
            options: [
              { id: 'm4a', text: 'M4A', quality: choice('best', 'best', '192') },
              { id: 'mp3', text: 'MP3', quality: choice('best', 'best', '320') },
              { id: 'opus', text: 'OPUS', quality: choice('best', 'best') },
            ],
          },
          audio_tags: choice('with_cover', 'with_cover', 'none'),
        },
        {
          id: 'captions', text: 'Captions',
          format: choice('srt', 'srt', 'vtt'),
          subtitle_mode: choice('prefer_manual', 'prefer_manual', 'auto_only'),
          subtitle_language: choice('en', 'en', 'de'),
        },
      ],
    },
  };
}

class DownloadsServiceStub {
  formats: FormatCatalog | null = testCatalog();
  formatsChanged = new Subject<FormatCatalog>();
  configuration: Record<string, unknown> = { CUSTOM_DIRS: true };
  customDirs = { download_dir: ['Music', 'Movies'], audio_download_dir: ['Music', 'Podcasts'] };
  configurationChanged = new Subject<void>();
  customDirsChanged = new Subject<void>();
  getPresets() {
    return of({ presets: ['Embed subs'] });
  }
}

describe('SettingsPageComponent', () => {
  let defaults: DefaultsServiceStub;

  beforeEach(async () => {
    Object.defineProperty(window, 'ResizeObserver', {
      writable: true,
      value: class {
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = vi.fn();
      },
    });
    defaults = new DefaultsServiceStub();
    await TestBed.configureTestingModule({
      imports: [SettingsPageComponent],
      providers: [
        provideRouter([]),
        { provide: DefaultsService, useValue: defaults },
        { provide: DownloadsService, useClass: DownloadsServiceStub },
      ],
    }).compileComponents();
  });

  const create = () => {
    const fixture = TestBed.createComponent(SettingsPageComponent);
    fixture.detectChanges();
    return fixture;
  };

  it('waits for the server before showing the form', () => {
    const fixture = create();
    expect(fixture.componentInstance.draft).toBeNull();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Loading the current defaults');

    defaults.defaults.set(formDefaults());
    fixture.detectChanges();

    expect(fixture.componentInstance.draft?.download_type).toBe('video');
    expect(fixture.componentInstance.dirty()).toBe(false);
  });

  it('saves the draft and is clean afterwards', () => {
    defaults.defaults.set(formDefaults());
    const page = create().componentInstance;

    page.draft!.download_type = 'audio';
    expect(page.dirty()).toBe(true);
    page.save();

    expect(defaults.saved[0].download_type).toBe('audio');
    expect(page.dirty()).toBe(false);
  });

  it('drops a quality the new audio format cannot produce', () => {
    defaults.defaults.set(formDefaults());
    const page = create().componentInstance;

    page.draft!.audio.format = 'opus';
    page.audioFormatChanged();

    expect(page.draft!.audio.quality).toBe('best');
  });

  it('takes defaults saved elsewhere, but not over unsaved edits', () => {
    defaults.defaults.set(formDefaults());
    const fixture = create();
    const page = fixture.componentInstance;

    defaults.defaults.set(formDefaults({ folder: 'Music' }));
    fixture.detectChanges();
    expect(page.draft!.folder).toBe('Music');

    page.draft!.folder = 'Mine';
    defaults.defaults.set(formDefaults({ folder: 'Podcasts' }));
    fixture.detectChanges();
    expect(page.draft!.folder).toBe('Mine');
    // Discard goes back to the newest saved values.
    page.discard();
    expect(page.draft!.folder).toBe('Podcasts');
  });

  it('asks before leaving with unsaved changes', async () => {
    defaults.defaults.set(formDefaults());
    const page = create().componentInstance;
    const confirm = vi.spyOn(TestBed.inject(ToastService), 'confirm').mockResolvedValue(false);

    await expect(page.confirmLeave()).resolves.toBe(true);
    expect(confirm).not.toHaveBeenCalled();

    page.draft!.sponsorblock = true;
    await expect(page.confirmLeave()).resolves.toBe(false);
    expect(confirm).toHaveBeenCalledTimes(1);
  });

  it('suggests folders from both download directories', () => {
    defaults.defaults.set(formDefaults());
    const page = create().componentInstance;
    expect(page.folderSuggestions()).toEqual(['Music', 'Movies', 'Podcasts']);
    page.draft!.folder = 'pod';
    expect(page.folderSuggestions()).toEqual(['Podcasts']);
  });
});

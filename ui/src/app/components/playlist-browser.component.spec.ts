import { TestBed } from '@angular/core/testing';
import { BrnDialogRef } from '@spartan-ng/brain/dialog';
import { Observable, of } from 'rxjs';
import { BrowsePayload, BrowseResult, DownloadsService } from '../services/downloads.service';
import { Download } from '../interfaces';
import { PlaylistBrowserComponent } from './playlist-browser.component';

const payload: BrowsePayload = {
  url: 'https://example.com/playlist',
  playlistItemLimit: 10,
  ytdlOptionsPresets: ['Preset A'],
  ytdlOptionsOverrides: '',
};

describe('PlaylistBrowserComponent', () => {
  let browse: ReturnType<typeof vi.fn>;
  let done: Map<string, Download>;
  let picked: ReturnType<typeof vi.fn<(urls: string[]) => void>>;
  let canceled: ReturnType<typeof vi.fn<() => void>>;

  const setup = (result: Observable<BrowseResult>) => {
    browse.mockReturnValue(result);
    const fixture = TestBed.createComponent(PlaylistBrowserComponent);
    fixture.componentRef.setInput('payload', payload);
    picked = vi.fn<(urls: string[]) => void>();
    canceled = vi.fn<() => void>();
    fixture.componentInstance.picked.subscribe(picked);
    fixture.componentInstance.canceled.subscribe(canceled);
    fixture.detectChanges();
    return fixture;
  };

  const okResult: BrowseResult = {
    status: 'ok',
    title: 'My Playlist',
    entries: [
      { url: 'https://example.com/a', title: 'First', duration: 65 },
      { url: 'https://example.com/b', title: 'Second', duration: 3725 },
      { url: 'https://example.com/a', title: 'First again', duration: null },
    ],
  };

  const addButton = (el: HTMLElement) =>
    Array.from(el.querySelectorAll('hlm-dialog-footer button')).find((b) =>
      b.textContent?.includes('Download selected'),
    ) as HTMLButtonElement;

  beforeEach(async () => {
    browse = vi.fn();
    done = new Map();
    await TestBed.configureTestingModule({
      imports: [PlaylistBrowserComponent],
      providers: [
        { provide: DownloadsService, useValue: { browse, done } },
        // The title and description directives take their ids from the dialog.
        { provide: BrnDialogRef, useValue: { dialogId: 'test', registerDescription: vi.fn(), unregisterDescription: vi.fn() } },
      ],
    }).compileComponents();
  });

  it('sends the payload to the browse request', () => {
    setup(of(okResult));
    expect(browse).toHaveBeenCalledWith(payload);
  });

  it('renders the title, entry count, entries and durations', () => {
    const el = setup(of(okResult)).nativeElement as HTMLElement;
    expect(el.querySelector('[hlmDialogTitle]')?.textContent).toContain('My Playlist');
    expect(el.querySelector('[hlmDialogTitle]')?.textContent).toContain('3 entries');
    const rows = el.querySelectorAll('tbody tr');
    expect(rows.length).toBe(3);
    expect(rows[0].textContent).toContain('First');
    expect(rows[0].textContent).toContain('1:05');
    expect(rows[1].textContent).toContain('1:02:05');
    // Duplicate URLs stay visible; a missing duration renders blank.
    expect(rows[2].textContent).toContain('First again');
    expect(rows[2].querySelector('td:last-child')?.textContent?.trim()).toBe('');
  });

  it('shows a spinner while loading', () => {
    const el = setup(new Observable<BrowseResult>(() => undefined)).nativeElement as HTMLElement;
    expect(el.textContent).toContain('Loading entries');
    expect(addButton(el).disabled).toBe(true);
  });

  it('starts with nothing checked and Download selected disabled', () => {
    const el = setup(of(okResult)).nativeElement as HTMLElement;
    const boxes = el.querySelectorAll<HTMLInputElement>('tbody input[type="checkbox"]');
    expect(boxes.length).toBe(3);
    expect(Array.from(boxes).every((b) => !b.checked)).toBe(true);
    expect(addButton(el).disabled).toBe(true);
    expect(addButton(el).textContent).toContain('(0)');
  });

  it('select-all checks every row and Download selected emits de-duplicated urls in order', () => {
    const fixture = setup(of(okResult));
    const el = fixture.nativeElement as HTMLElement;
    // Select-all is a Spartan checkbox: a button with the checkbox role.
    el.querySelector<HTMLButtonElement>('thead button[role="checkbox"]')!.click();
    fixture.detectChanges();
    expect(addButton(el).disabled).toBe(false);
    expect(addButton(el).textContent).toContain('(3)');
    addButton(el).click();
    expect(picked).toHaveBeenCalledWith([
      'https://example.com/a',
      'https://example.com/b',
    ]);
  });

  it('adds only the ticked rows', async () => {
    const fixture = setup(of(okResult));
    // ngModel pushes its initial value in a microtask; a click before that gets overwritten.
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    el.querySelectorAll<HTMLInputElement>('tbody input[type="checkbox"]')[1].click();
    fixture.detectChanges();
    expect(addButton(el).textContent).toContain('(1)');
    addButton(el).click();
    expect(picked).toHaveBeenCalledWith(['https://example.com/b']);
  });

  it('badges only entries that are finished in the Completed list', () => {
    done.set('https://example.com/a', {
      url: 'https://example.com/a',
      status: 'finished',
    } as Download);
    done.set('https://example.com/b', {
      url: 'https://example.com/b',
      status: 'error',
    } as Download);
    const el = setup(of(okResult)).nativeElement as HTMLElement;
    const rows = el.querySelectorAll('tbody tr');
    expect(rows[0].querySelector('[hlmBadge]')?.textContent).toContain('Downloaded');
    expect(rows[1].querySelector('[hlmBadge]')).toBeNull();
    expect(rows[2].querySelector('[hlmBadge]')).not.toBeNull();
  });

  it('renders the error message', () => {
    const el = setup(of({ status: 'error', msg: 'This URL points to a single video' }))
      .nativeElement as HTMLElement;
    expect(el.querySelector('[hlmAlert]')?.textContent).toContain(
      'This URL points to a single video',
    );
    expect(el.querySelector('table')).toBeNull();
    expect(addButton(el).disabled).toBe(true);
  });

  it('Cancel asks the opener to close', () => {
    const el = setup(of(okResult)).nativeElement as HTMLElement;
    (el.querySelector('hlm-dialog-footer button') as HTMLButtonElement).click();
    expect(canceled).toHaveBeenCalled();
  });
});

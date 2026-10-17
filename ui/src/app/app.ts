import { DatePipe, KeyValuePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, ElementRef, Injector, afterNextRender, effect, viewChild, inject, OnDestroy, OnInit, untracked } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Observable, Subject, Subscription, filter, from, finalize, map, mergeMap, take, takeUntil, tap, timer } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { HlmAlertImports } from '@spartan-ng/helm/alert';
import { HlmAutocompleteImports } from '@spartan-ng/helm/autocomplete';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmCheckboxImports } from '@spartan-ng/helm/checkbox';
import { HlmCollapsibleImports } from '@spartan-ng/helm/collapsible';
import { HlmComboboxImports } from '@spartan-ng/helm/combobox';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { HlmDropdownMenuImports } from '@spartan-ng/helm/dropdown-menu';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmInputGroupImports } from '@spartan-ng/helm/input-group';
import { HlmProgressImports } from '@spartan-ng/helm/progress';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { HlmSwitchImports } from '@spartan-ng/helm/switch';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { HlmTextareaImports } from '@spartan-ng/helm/textarea';
import { HlmTooltipImports } from '@spartan-ng/helm/tooltip';
import { faTrashAlt, faCheckCircle, faTimesCircle, faRedoAlt, faSun, faMoon, faCheck, faCircleHalfStroke, faDownload, faFileImport, faFileExport, faCopy, faClock, faTachometerAlt, faSortAmountDown, faSortAmountUp, faChevronRight, faChevronDown, faUpload, faPause, faPlay, faRss, faSlidersH, faRotateLeft, faXmark, faPaste, faListCheck } from '@fortawesome/free-solid-svg-icons';
import { faGithub } from '@fortawesome/free-brands-svg-icons';
import { CookieService } from 'ngx-cookie-service';
import { ADD_REQUEST_CONCURRENCY, AddDownloadPayload, DownloadsService } from './services/downloads.service';
import { MeTubeSocket } from './services/metube-socket.service';
import { SubscriptionsService } from './services/subscriptions.service';
import { ToastService } from './services/toast.service';
import { DefaultsService } from './services/defaults.service';
import { SettingsStore } from './services/settings-store.service';
import { BatchUrlsService, BatchUrlFilter } from './services/batch-urls.service';
import { SubscriptionRow } from './interfaces/subscription';
import { Themes } from './theme';
import {
  Download,
  FormDefaults,
  Status,
  Theme,
  Option,
  Choice,
  DownloadTypeOption,
  FormatCatalog,
  FormatOption,
  State,
} from './interfaces';
import { SpeedPipe } from './pipes';
import {
  SelectAllCheckboxComponent,
  ToastContainerComponent,
  DownloadRowComponent,
  DoneEntryComponent,
  HelpLabelComponent,
  TooltipLayerComponent,
  PlaylistBrowserComponent,
} from './components/';
import { BrowsePayload } from './services/downloads.service';
import { GROUP_SELECT_TRIGGER_CLASS, optionLabel } from './form-options';
import {
  buildChapterDownloadLink,
  buildDownloadLink,
  downloadTypeLabel,
  formatCodecLabel,
  formatLabel,
  formatQualityLabel,
  isIndeterminate,
} from './download-display';

// The views the pills above the lists switch between. Completed and failed
// are both the done list, split by outcome.
const LIST_VIEWS = ['downloading', 'completed', 'failed', 'subscriptions'] as const;
type ListView = typeof LIST_VIEWS[number];

// The browser's RegExp error names the problem after a prefix that repeats the
// pattern ("Invalid regular expression: /[/: Unterminated character class").
export function regexErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : '';
  const reason = raw.split(': ').pop()?.trim() ?? '';
  return reason && reason !== raw
    ? `This isn't a valid regular expression: ${reason.charAt(0).toLowerCase()}${reason.slice(1)}.`
    : "This isn't a valid regular expression.";
}

// yt-dlp wraps its errors in the log level and the extractor that raised them,
// and often a Python exception repr at the end ("ERROR: [generic] abc: Unable to
// download webpage: HTTP Error 404 (caused by <HTTPError 404>)"). The user needs
// the sentence in between.
export function plainAddError(msg: string | null | undefined): string {
  const text = (msg ?? '')
    .replace(/^\s*ERROR:\s*/i, '')
    .replace(/^\[[^\]]+\]\s*/, '')
    .replace(/\s*\(caused by .*\)\s*$/i, '')
    .trim();
  // Read as a sentence, so a note can follow it.
  return text && !/[.!?]$/.test(text) ? `${text}.` : text;
}

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
        FormsModule,
        RouterOutlet,
        RouterLink,
        RouterLinkActive,
        KeyValuePipe,
        DatePipe,
        FontAwesomeModule,
        HlmAlertImports,
        HlmAutocompleteImports,
        HlmButtonImports,
        HlmCheckboxImports,
        HlmCollapsibleImports,
        HlmComboboxImports,
        HlmDialogImports,
        HlmDropdownMenuImports,
        HlmInputImports,
        HlmInputGroupImports,
        HlmProgressImports,
        HlmSelectImports,
        HlmSpinnerImports,
        HlmSwitchImports,
        HlmTableImports,
        HlmTextareaImports,
        HlmTooltipImports,
        SpeedPipe,
        SelectAllCheckboxComponent,
        ToastContainerComponent,
        DownloadRowComponent,
        DoneEntryComponent,
        HelpLabelComponent,
        TooltipLayerComponent,
        PlaylistBrowserComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.sass',
})
export class App implements AfterViewInit, OnInit, OnDestroy {
  downloads = inject(DownloadsService);
  subscriptionsSvc = inject(SubscriptionsService);
  private toasts = inject(ToastService);
  private batchUrls = inject(BatchUrlsService);
  private socket = inject(MeTubeSocket);
  private cookieService = inject(CookieService);
  private settings = inject(SettingsStore);
  private defaultsSvc = inject(DefaultsService);
  private router = inject(Router);
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);
  private injector = inject(Injector);

  addUrl!: string;
  // What the URL bar's main button does. Download is the default; Subscribe is
  // picked from the split button's menu and goes back to Download as soon as a
  // subscription is sent, so the next paste is never an accidental one.
  addMode: 'download' | 'subscribe' = 'download';
  // A problem with the link just submitted, shown under the URL bar.
  addError: string | null = null;
  // The backend keeps a rejected link as a Failed row so it can be retried; set
  // once that row has arrived, so the message can say where it went.
  addErrorKeptInFailed = false;
  // A bad title filter, shown under that field rather than the URL.
  titleRegexError: string | null = null;
  // A subscription on its way to the server. The backend reads the whole channel
  // before answering and can't be cancelled, so rather than hold the URL bar for
  // that long, the bar is released at once and the wait is reported under the
  // list pills. One at a time: a second Subscribe waits for this one.
  pendingSubscription: { url: string } | null = null;
  subscribeElapsed = 0;
  private subscribeTimer?: ReturnType<typeof setInterval>;
  // The server's catalog of download options (app/format_catalog.py); the
  // form's option fields are not shown until it arrives. The lists below are
  // the parts of it the form is currently showing.
  catalog: FormatCatalog | null = null;
  downloadTypes: DownloadTypeOption[] = [];
  codecOptions: Option[] = [];
  formatOptions: FormatOption[] = [];
  qualities: Option[] = [];
  audioTagsOptions: Option[] = [];
  subtitleLanguages: Option[] = [];
  subtitleModes: Option[] = [];
  // The playlist or channel being browsed for entries to queue; the browse
  // dialog is open while this is set.
  browsePayload: BrowsePayload | null = null;
  downloadType: string;
  codec: string;
  quality: string;
  format: string;
  folder!: string;
  customNamePrefix!: string;
  autoStart: boolean;
  playlistItemLimit!: number;
  splitByChapters: boolean;
  sponsorblock: boolean;
  audioTags: string;
  chapterTemplate: string;
  clipStart = '';
  clipEnd = '';
  videoPassword = '';
  subtitleLanguage: string;
  subtitleMode: string;
  ytdlOptionsPresets: string[] = [];
  ytdlOptionsOverrides: string;
  ytdlOptionPresetNames: string[] = [];
  addInProgress = false;
  cancelRequested = false;
  checkIntervalMinutes = 60;
  titleRegex = '';
  skipSubscriberOnly = false;
  editingTitleRegexId: string | null = null;
  titleRegexEditDraft = '';
  editingNameId: string | null = null;
  nameEditDraft = '';
  readonly subscriptionNameMaxLength = 200;
  cachedSubs: [string, SubscriptionRow][] = [];
  selectedSubscriptionIds = new Set<string>();
  checkingSubscriptionIds = new Set<string>();
  checkingAllSubscriptions = false;
  checkingSelectedSubscriptions = false;
  hasCookies = false;
  cookieUploadInProgress = false;
  themes: Theme[] = Themes;
  activeTheme: Theme | undefined;
  showBatchPanel = false;
  batchImportModalOpen = false;
  batchImportText = '';
  batchImportStatus = '';
  batchImportCount = 0;
  batchImportTotal = 0;
  batchImportFailures = 0;
  importInProgress = false;
  private batchImportCancel$ = new Subject<void>();
  ytDlpOptionsUpdateTime: string | null = null;
  ytDlpVersion: string | null = null;
  metubeVersion: string | null = null;
  isAdvancedOpen = false;
  sortAscending = false;
  listView: ListView = 'downloading';
  expandedErrors: Set<string> = new Set<string>();
  // The done entries the current view shows (finished ones, or failed ones),
  // sorted for display.
  cachedSortedDone: [string, Download][] = [];
  // The same entries as a map, so select-all only reaches rows on screen.
  cachedVisibleDone = new Map<string, Download>();
  // The done ids in rendered order, so a shift-click range follows the sort
  // the user is looking at rather than the map's insertion order.
  cachedSortedDoneIds: string[] = [];
  // Queue ids that just arrived, so their rows fade in. Only downloads added
  // while the page is open: the list the server sends on connect, and rows
  // remounted by switching views, appear without animating.
  enteringQueueIds = new Set<string>();
  private knownQueueIds: Set<string> | null = null;
  private static readonly QUEUE_ROW_ENTER_MS = 300;
  lastCopiedErrorId: string | null = null;
  // Fixed for the page's lifetime, so read once rather than per row per render.
  readonly canShare = this.canShareDownloads();
  // Wall-clock time the live-stream countdowns are computed against; ticked
  // once a second while a scheduled stream is waiting.
  now = Date.now();
  private previousDownloadType = '';
  private addRequestSub?: Subscription;
  private liveCountdownTimer?: ReturnType<typeof setInterval>;
  private selectionsByType: Record<string, {
    codec: string;
    format: string;
    quality: string;
    subtitleLanguage: string;
    subtitleMode: string;
  }> = {};
  private readonly selectionKeyPrefix = 'metube_selection_';
  // The theme is the one setting kept in a cookie: the server sets it to
  // DEFAULT_THEME on a first visit. Everything else is in SettingsStore.
  private static readonly THEME_COOKIE_EXPIRY_DAYS = 3650;
  private lastFocusedElement: HTMLElement | null = null;
  private colorSchemeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  private onColorSchemeChanged = () => {
    if (this.activeTheme && this.activeTheme.id === 'auto') {
      this.setTheme(this.activeTheme);
    }
  };

  // The downloads page stays mounted behind Settings, so returning to it keeps
  // the form, selections and long tables as they were.
  readonly onSettingsPage = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(e => this.router.parseUrl(e.urlAfterRedirects).root.children['primary']?.segments[0]?.path === 'settings'),
    ),
    { initialValue: false },
  );
  // The defaults last applied to the form, to tell a field the user has
  // edited this session (value differs) from one still on its default.
  private appliedDefaults: FormDefaults | null = null;

  // Download metrics
  activeDownloads = 0;
  queuedDownloads = 0;
  // Added with auto-start off and waiting for Start.
  pendingDownloads = 0;
  // Reading the clipboard needs a secure context (HTTPS or localhost).
  readonly canPaste = typeof navigator !== 'undefined' && !!navigator.clipboard?.readText;
  completedDownloads = 0;
  failedDownloads = 0;
  totalSpeed = 0;
  hasCompletedDone = false;
  hasFailedDone = false;

  readonly queueMasterCheckbox = viewChild<SelectAllCheckboxComponent>('queueMasterCheckboxRef');
  readonly doneMasterCheckbox = viewChild<SelectAllCheckboxComponent>('doneMasterCheckboxRef');
  private readonly urlInput = viewChild<ElementRef<HTMLInputElement>>('urlInput');
  private readonly titleRegexInput = viewChild<ElementRef<HTMLInputElement>>('titleRegexInput');
  private readonly listViews = viewChild<ElementRef<HTMLElement>>('listViews');
  // Labels for the select triggers, which show the selected option's text
  // rather than its id. Arrow functions so the select keeps one reference.
  readonly downloadTypeText = optionLabel(() => this.downloadTypes);
  readonly codecText = optionLabel(() => this.codecOptions);
  readonly formatText = optionLabel(() => this.formatOptions);
  readonly qualityText = optionLabel(() => this.qualities);
  readonly audioTagsText = optionLabel(() => this.audioTagsOptions);
  readonly subtitleModeText = optionLabel(() => this.subtitleModes);
  readonly autoStartText = (value: unknown) => (value ? 'Yes' : 'No');

  readonly groupSelectClass = GROUP_SELECT_TRIGGER_CLASS;

  // Selected rows per table; the "… selected" toolbar buttons key off these.
  queueSelectedCount = 0;
  doneSelectedCount = 0;

  faTrashAlt = faTrashAlt;
  faRss = faRss;
  faSlidersH = faSlidersH;
  faRotateLeft = faRotateLeft;
  faCheckCircle = faCheckCircle;
  faTimesCircle = faTimesCircle;
  faXmark = faXmark;
  faPaste = faPaste;
  faRedoAlt = faRedoAlt;
  faSun = faSun;
  faMoon = faMoon;
  faCheck = faCheck;
  faCircleHalfStroke = faCircleHalfStroke;
  faDownload = faDownload;
  faFileImport = faFileImport;
  faFileExport = faFileExport;
  faCopy = faCopy;
  faGithub = faGithub;
  faClock = faClock;
  faTachometerAlt = faTachometerAlt;
  faSortAmountDown = faSortAmountDown;
  faSortAmountUp = faSortAmountUp;
  faChevronRight = faChevronRight;
  faChevronDown = faChevronDown;
  faUpload = faUpload;
  faPause = faPause;
  faPlay = faPlay;
  faListCheck = faListCheck;
  constructor() {
    // Remembered choices are checked against the catalog when it arrives.
    this.downloadType = this.settings.get('metube_download_type');
    this.codec = this.settings.get('metube_codec');
    this.format = this.settings.get('metube_format');
    this.quality = this.settings.get('metube_quality');
    this.autoStart = this.settings.get('metube_auto_start') !== 'false';
    this.splitByChapters = this.settings.get('metube_split_chapters') === 'true';
    this.sponsorblock = this.settings.get('metube_sponsorblock') === 'true';
    this.audioTags = this.settings.get('metube_audio_tags');
    // Will be set from backend configuration, use empty string as placeholder
    this.chapterTemplate = this.settings.get('metube_chapter_template') || '';
    this.clipStart = this.settings.get('metube_clip_start') || '';
    this.clipEnd = this.settings.get('metube_clip_end') || '';
    this.subtitleLanguage = this.settings.get('metube_subtitle_language');
    this.subtitleMode = this.settings.get('metube_subtitle_mode');
    this.ytdlOptionsPresets = this.loadStoredYtdlOptionsPresets();
    this.ytdlOptionsOverrides = this.settings.get('metube_ytdl_options_overrides') || '';
    if (this.downloads.formats) {
      this.applyCatalog(this.downloads.formats);
    }
    this.downloads.formatsChanged.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((catalog) => {
      this.applyCatalog(catalog);
      this.cdr.markForCheck();
    });
    this.sortAscending = this.settings.get('metube_sort_ascending') === 'true';
    const savedView = this.settings.get('metube_list_view') as ListView;
    if (LIST_VIEWS.includes(savedView)) {
      this.listView = savedView;
    }

    const ci = parseInt(this.settings.get('metube_check_interval') || '', 10);
    if (!Number.isNaN(ci) && ci >= 1) {
      this.checkIntervalMinutes = ci;
    }
    this.activeTheme = this.getPreferredTheme(this.cookieService);

    // Subscribe to download updates
    this.downloads.queueChanged.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.trackEnteringQueueRows();
      this.updateQueueMetrics();
      this.syncLiveCountdownTimer();
      // An emptied list replaces its table with the empty state, taking the
      // select-all box (and its count reports) with it.
      if (this.downloads.queue.size === 0) {
        this.queueSelectedCount = 0;
      }
      // Undefined until the view exists; the first render reads the list itself.
      this.queueMasterCheckbox()?.selectionChanged();
      this.cdr.markForCheck();
    });
    this.downloads.doneChanged.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.updateDoneMetrics();
      this.rebuildSortedDone();
      if (this.cachedSortedDone.length === 0) {
        this.doneSelectedCount = 0;
      }
      // The Failed pill comes and goes with the history, shifting the pills
      // after it; keep the active one in view.
      afterNextRender(() => this.revealActivePill(), { injector: this.injector });
      this.doneMasterCheckbox()?.selectionChanged();
      this.cdr.markForCheck();
    });
    // Subscribe to real-time updates
    this.downloads.updated.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.updateQueueMetrics();
      this.syncLiveCountdownTimer();
      this.cdr.markForCheck();
    });

    effect(() => {
      const defaults = this.defaultsSvc.defaults();
      if (defaults) {
        untracked(() => this.applyFormDefaults(defaults));
      }
    });

    this.subscriptionsSvc.subscriptionsChanged.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.rebuildCachedSubs();
      this.cdr.markForCheck();
    });
  }

  ngOnInit() {
    this.downloads.getCookieStatus().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(data => {
      this.hasCookies = !!(data && typeof data === 'object' && 'has_cookies' in data && data.has_cookies);
      this.cdr.markForCheck();
    });
    this.getConfiguration();
    this.getYtdlOptionsUpdateTime();
    this.getYtdlOptionPresets();
    this.setTheme(this.activeTheme!);

    this.colorSchemeMediaQuery.addEventListener('change', this.onColorSchemeChanged);
  }

  ngAfterViewInit() {
    // Counts and action button states for already-loaded entries.
    this.updateDoneMetrics();
    this.focusUrlWhenReady();
    document.addEventListener('paste', this.onDocumentPaste);
    afterNextRender(() => this.revealActivePill(), { injector: this.injector });
    this.fetchVersionInfo();
    this.socket.fromEvent('connect')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.fetchVersionInfo());
  }

  ngOnDestroy() {
    this.addRequestSub?.unsubscribe();
    if (this.liveCountdownTimer) {
      clearInterval(this.liveCountdownTimer);
    }
    clearInterval(this.subscribeTimer);
    document.removeEventListener('paste', this.onDocumentPaste);
    this.colorSchemeMediaQuery.removeEventListener('change', this.onColorSchemeChanged);
  }

  // keyvalue comparator that preserves insertion order (Angular's keyvalue
  // pipe sorts by key by default): https://github.com/angular/angular/issues/31420
  asIsOrder() {
    return 0;
  }

  qualityChanged() {
    this.settings.set('metube_quality', this.quality);
    this.saveSelection(this.downloadType);
  }

  downloadTypeChanged() {
    // Each option's own change handler already saved the user's choices;
    // switching type alone chooses nothing for either type.
    this.saveSelection(this.previousDownloadType, false);
    this.restoreSelection(this.downloadType);
    this.settings.set('metube_download_type', this.downloadType);
    this.normalizeSelectionsForType();
    this.setQualities();
    this.refreshFormatOptions();
    this.saveSelection(this.downloadType, false);
    this.previousDownloadType = this.downloadType;
  }

  codecChanged() {
    this.settings.set('metube_codec', this.codec);
    this.saveSelection(this.downloadType);
  }

  showAdvanced() {
    return this.downloads.configuration['CUSTOM_DIRS'];
  }

  allowYtdlOptionsOverrides() {
    return this.downloads.configuration['ALLOW_YTDL_OPTIONS_OVERRIDES'] === true;
  }

  private existingFolders(): string[] {
    return this.isAudioType()
      ? (this.downloads.customDirs?.['audio_download_dir'] ?? [])
      : (this.downloads.customDirs?.['download_dir'] ?? []);
  }

  // Existing folders for the download type, filtered by what has been typed.
  folderSuggestions(): string[] {
    const dirs = this.existingFolders();
    const t = (this.folder ?? '').toLowerCase();
    return (t === '' ? dirs : dirs.filter(d => d.toLowerCase().includes(t))).slice(0, 10);
  }

  folderSearchChanged(value: string | null) {
    this.folder = value ?? '';
  }

  // Without CREATE_CUSTOM_DIRS the server rejects folders that don't exist,
  // so a typed name that isn't one of the listed folders is dropped on blur.
  folderBlurred() {
    if (this.downloads.configuration['CREATE_CUSTOM_DIRS'] || !this.folder) {
      return;
    }
    if (!this.existingFolders().includes(this.folder)) {
      this.folder = '';
      this.cdr.markForCheck();
    }
  }

  isAudioType() {
    return this.downloadType === 'audio';
  }

  getYtdlOptionsUpdateTime() {
    this.downloads.ytdlOptionsChanged.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
       // eslint-disable-next-line @typescript-eslint/no-explicit-any
      next: (data:any) => {
        if (data['success']){
          const date = new Date(data['update_time'] * 1000);
          this.ytDlpOptionsUpdateTime=date.toLocaleString();
        }else{
          this.toasts.error("Error reloading yt-dlp options: " + data['msg']);
        }
        this.cdr.markForCheck();
      }
    });
  }
  getConfiguration() {
    this.downloads.configurationChanged.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.cdr.markForCheck();
      }
    });
  }

  getYtdlOptionPresets() {
    this.downloads.getPresets().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (data) => {
        this.ytdlOptionPresetNames = Array.isArray(data?.presets)
          ? data.presets.filter((preset): preset is string => typeof preset === 'string')
          : [];
        if (this.ytdlOptionsPresets?.length) {
          const valid = new Set(this.ytdlOptionPresetNames);
          const filtered = this.ytdlOptionsPresets.filter((p) => valid.has(p));
          if (filtered.length !== this.ytdlOptionsPresets.length) {
            this.ytdlOptionsPresets = filtered;
            this.ytdlOptionsPresetsChanged();
          }
        }
        this.cdr.markForCheck();
      },
    });
  }

  private loadStoredYtdlOptionsPresets(): string[] {
    const stored = this.settings.get('metube_ytdl_options_presets');
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as unknown;
        if (Array.isArray(parsed)) {
          return parsed.filter((p): p is string => typeof p === 'string' && p.length > 0);
        }
      } catch {
        // fall through to the legacy single-preset value
      }
    }
    const legacy = this.settings.get('metube_ytdl_options_preset')?.trim();
    return legacy ? [legacy] : [];
  }

  private validateYtdlOptionsOverrides(value: string): boolean {
    if (!this.allowYtdlOptionsOverrides()) {
      return true;
    }
    const trimmed = value?.trim() || '';
    if (!trimmed) {
      return true;
    }
    try {
      const parsed = JSON.parse(trimmed);
      if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
        this.toasts.error('Custom yt-dlp options must be a JSON object');
        return false;
      }
    } catch {
      this.toasts.error('Custom yt-dlp options must be valid JSON');
      return false;
    }
    return true;
  }

  private rebuildCachedSubs() {
    this.cachedSubs = Array.from(this.subscriptionsSvc.subscriptions.entries());
    const validIds = new Set(this.cachedSubs.map(([id]) => id));
    for (const id of [...this.selectedSubscriptionIds]) {
      if (!validIds.has(id)) {
        this.selectedSubscriptionIds.delete(id);
      }
    }
  }

  checkIntervalChanged() {
    this.settings.set('metube_check_interval', String(this.checkIntervalMinutes));
  }

  private getStatusError(res: unknown): string | null {
    const status = res as { status?: string; msg?: string };
    return status?.status === 'error' ? status.msg || null : null;
  }

  private handleActionResult(res: unknown, fallbackMsg: string) {
    const error = this.getStatusError(res);
    if (error) {
      this.toasts.error(error || fallbackMsg);
    }
    this.cdr.markForCheck();
  }

  private refreshSubscriptionsWithAlert() {
    this.subscriptionsSvc.refreshList().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((refreshRes) => {
      const error = this.getStatusError(refreshRes);
      if (error) {
        this.toasts.error(error || 'Refresh subscriptions failed');
        return;
      }
      this.cdr.markForCheck();
    });
  }

  isSubSelected(id: string): boolean {
    return this.selectedSubscriptionIds.has(id);
  }

  toggleSubSelected(id: string) {
    if (this.selectedSubscriptionIds.has(id)) {
      this.selectedSubscriptionIds.delete(id);
    } else {
      this.selectedSubscriptionIds.add(id);
    }
    this.cdr.markForCheck();
  }

  toggleSubMaster(checked: boolean) {
    this.selectedSubscriptionIds.clear();
    if (checked) {
      for (const [id] of this.cachedSubs) {
        this.selectedSubscriptionIds.add(id);
      }
    }
    this.cdr.markForCheck();
  }

  allSubsSelected(): boolean {
    if (this.cachedSubs.length === 0) {
      return false;
    }
    return this.cachedSubs.every(([id]) => this.selectedSubscriptionIds.has(id));
  }

  addSubscription() {
    if (this.pendingSubscription) {
      this.showAddError('Another subscription is still being set up. Try again when it finishes.');
      return;
    }
    const payload = this.buildAddPayload();
    if (!payload.url?.trim()) {
      this.showAddError('Paste a channel or playlist link first.');
      return;
    }
    const tr = (this.titleRegex || '').trim();
    if (tr) {
      try {
        void RegExp(tr);
      } catch (e) {
        this.titleRegexError = regexErrorMessage(e);
        this.cdr.markForCheck();
        this.titleRegexInput()?.nativeElement.focus();
        return;
      }
    }
    if (payload.splitByChapters && !payload.chapterTemplate.includes('%(section_number)')) {
      this.toasts.error('Chapter template must include %(section_number)');
      return;
    }
    if (!this.validateYtdlOptionsOverrides(payload.ytdlOptionsOverrides)) {
      return;
    }
    const submitted = {
      url: payload.url.trim(),
      titleRegex: this.titleRegex,
      skipSubscriberOnly: this.skipSubscriberOnly,
    };
    const request = this.subscriptionsSvc.subscribe({
      ...payload,
      checkIntervalMinutes: this.checkIntervalMinutes,
      titleRegex: tr,
      skipSubscriberOnly: this.skipSubscriberOnly,
    });

    // Release the bar now; the request reports under the list pills.
    this.clearAddError();
    this.addUrl = '';
    this.titleRegex = '';
    this.skipSubscriberOnly = false;
    this.addMode = 'download';
    this.pendingSubscription = { url: submitted.url };
    this.subscribeElapsed = 0;
    this.subscribeTimer = setInterval(() => {
      this.subscribeElapsed++;
      this.cdr.markForCheck();
    }, 1000);
    this.cdr.markForCheck();

    request
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.pendingSubscription = null;
          clearInterval(this.subscribeTimer);
          this.subscribeTimer = undefined;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (res) => {
          const r = res as { status?: string; msg?: string };
          if (r.status === 'error') {
            this.restoreFailedSubscription(submitted, plainAddError(r.msg) || "Couldn't subscribe to this link.");
          } else {
            this.toasts.success(`Subscribed to ${submitted.url}.`);
          }
        },
      });
  }

  // A failed subscription goes back into the bar, in Subscribe mode with its
  // settings, so it can be fixed and resent. If the bar has moved on to another
  // link in the meantime, that link is left alone and the failure is a toast.
  private restoreFailedSubscription(
    submitted: { url: string; titleRegex: string; skipSubscriberOnly: boolean },
    message: string,
  ) {
    if (this.addUrl?.trim()) {
      this.toasts.error(`Couldn't subscribe to ${submitted.url}: ${message}`);
      return;
    }
    this.addUrl = submitted.url;
    this.addMode = 'subscribe';
    this.titleRegex = submitted.titleRegex;
    this.skipSubscriberOnly = submitted.skipSubscriberOnly;
    this.showAddError(message);
  }

  beginEditTitleRegex(id: string, current: string | undefined) {
    this.editingTitleRegexId = id;
    this.titleRegexEditDraft = current ?? '';
    this.cdr.markForCheck();
  }

  cancelEditTitleRegex() {
    this.editingTitleRegexId = null;
    this.titleRegexEditDraft = '';
    this.cdr.markForCheck();
  }

  saveTitleRegex(id: string) {
    const raw = (this.titleRegexEditDraft || '').trim();
    if (raw) {
      try {
        void RegExp(raw);
      } catch {
        this.toasts.error('Invalid subscription title filter (regex)');
        return;
      }
    }
    this.subscriptionsSvc.update(id, { title_regex: raw }).subscribe((res) => {
      const error = this.getStatusError(res);
      if (error) {
        this.toasts.error(error || 'Update subscription failed');
        return;
      }
      this.cancelEditTitleRegex();
    });
  }

  beginEditName(id: string, current: string | undefined) {
    this.editingNameId = id;
    this.nameEditDraft = current ?? '';
    this.cdr.markForCheck();
  }

  cancelEditName() {
    this.editingNameId = null;
    this.nameEditDraft = '';
    this.cdr.markForCheck();
  }

  saveName(id: string) {
    const name = (this.nameEditDraft || '').trim();
    if (!name) {
      this.toasts.error('Subscription name must not be empty');
      return;
    }
    this.subscriptionsSvc.update(id, { name }).subscribe((res) => {
      const error = this.getStatusError(res);
      if (error) {
        this.toasts.error(error || 'Update subscription failed');
        return;
      }
      this.cancelEditName();
    });
  }

  deleteSubscription(id: string) {
    this.subscriptionsSvc.delete([id]).subscribe((res) => {
      const error = this.getStatusError(res);
      if (error) {
        this.toasts.error(error || 'Delete subscription failed');
        return;
      }
      this.selectedSubscriptionIds.delete(id);
      this.cdr.markForCheck();
    });
  }

  deleteSelectedSubscriptions() {
    const ids = Array.from(this.selectedSubscriptionIds);
    if (!ids.length) {
      return;
    }
    this.subscriptionsSvc.delete(ids).subscribe((res) => {
      const error = this.getStatusError(res);
      if (error) {
        this.toasts.error(error || 'Delete subscriptions failed');
        return;
      }
      this.selectedSubscriptionIds.clear();
      this.cdr.markForCheck();
    });
  }

  checkSubscriptionNow(id: string) {
    if (this.checkingSubscriptionIds.has(id)) {
      return;
    }
    this.checkingSubscriptionIds.add(id);
    this.cdr.markForCheck();
    this.subscriptionsSvc
      .checkNow([id])
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.checkingSubscriptionIds.delete(id);
          this.cdr.markForCheck();
        }),
      )
      .subscribe((res) => {
        const error = this.getStatusError(res);
        if (error) {
          this.toasts.error(error || 'Subscription check failed');
          return;
        }
        this.refreshSubscriptionsWithAlert();
      });
  }

  isSubscriptionChecking(id: string): boolean {
    return this.checkingSubscriptionIds.has(id);
  }

  private runBulkSubscriptionCheck(ids: string[] | undefined, mode: 'all' | 'selected') {
    const targetIds = ids ?? this.cachedSubs.filter(([, row]) => row.enabled).map(([id]) => id);
    if (!targetIds.length) {
      return;
    }

    const checkedIds = new Set(targetIds);
    for (const id of checkedIds) {
      this.checkingSubscriptionIds.add(id);
    }
    if (mode === 'all') {
      this.checkingAllSubscriptions = true;
    } else {
      this.checkingSelectedSubscriptions = true;
    }
    this.cdr.markForCheck();

    this.subscriptionsSvc
      .checkNow(ids)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          for (const id of checkedIds) {
            this.checkingSubscriptionIds.delete(id);
          }
          if (mode === 'all') {
            this.checkingAllSubscriptions = false;
          } else {
            this.checkingSelectedSubscriptions = false;
          }
          this.cdr.markForCheck();
        }),
      )
      .subscribe((res) => {
        const error = this.getStatusError(res);
        if (error) {
          this.toasts.error(error || 'Subscription check failed');
          return;
        }
        this.refreshSubscriptionsWithAlert();
      });
  }

  checkSelectedSubscriptions() {
    const ids = Array.from(this.selectedSubscriptionIds);
    if (!ids.length) {
      return;
    }
    this.runBulkSubscriptionCheck(ids, 'selected');
  }

  checkAllSubscriptions() {
    this.runBulkSubscriptionCheck(undefined, 'all');
  }

  toggleSubscriptionEnabled(row: SubscriptionRow) {
    this.subscriptionsSvc.update(row.id, { enabled: !row.enabled }).subscribe((res) => {
      const error = this.getStatusError(res);
      if (error) {
        this.toasts.error(error || 'Update subscription failed');
      }
    });
  }

  getPreferredTheme(cookieService: CookieService) {
    let theme = 'auto';
    if (cookieService.check('metube_theme')) {
      theme = cookieService.get('metube_theme');
    }

    return this.themes.find(x => x.id === theme) ?? this.themes.find(x => x.id === 'auto');
  }

  themeChanged(theme: Theme) {
    this.cookieService.set('metube_theme', theme.id, { expires: App.THEME_COOKIE_EXPIRY_DAYS });
    this.setTheme(theme);
  }

  setTheme(theme: Theme) {
    this.activeTheme = theme;
    const dark = theme.id === 'dark'
      || (theme.id === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    const root = document.documentElement;
    if (root.classList.contains('dark') !== dark) {
      // Swap the palette with transitions off. Otherwise every row and button in
      // a long history runs its own colour transition, all at the same moment.
      root.classList.add('theme-switching');
      root.classList.toggle('dark', dark);
      // Reading a style makes the browser apply the new palette now, while
      // transitions are still off.
      void window.getComputedStyle(document.body).color;
      requestAnimationFrame(() => root.classList.remove('theme-switching'));
    }
    this.cdr.markForCheck();
  }

  formatChanged() {
    this.settings.set('metube_format', this.format);
    this.setQualities();
    this.saveSelection(this.downloadType);
  }

  autoStartChanged() {
    this.settings.set('metube_auto_start', this.autoStart ? 'true' : 'false');
  }

  audioTagsChanged(value: string) {
    this.audioTags = value;
    this.settings.set('metube_audio_tags', this.audioTags);
  }

  // Whether the selected audio format can carry tags (the catalog's flag).
  tagsSupported(): boolean {
    return this.selectedFormat()?.tags !== false;
  }

  // A format that cannot carry tags shows None (disabled) without overwriting
  // the saved choice for the other formats.
  displayedAudioTags(): string {
    return this.tagsSupported() ? this.audioTags : 'none';
  }

  sponsorblockChanged() {
    this.settings.set('metube_sponsorblock', this.sponsorblock ? 'true' : 'false');
  }

  splitByChaptersChanged() {
    this.settings.set('metube_split_chapters', this.splitByChapters ? 'true' : 'false');
  }

  chapterTemplateChanged() {
    // Restore default if template is cleared - get from configuration
    if (!this.chapterTemplate || this.chapterTemplate.trim() === '') {
      const configuredTemplate = this.downloads.configuration['OUTPUT_TEMPLATE_CHAPTER'];
      this.chapterTemplate = typeof configuredTemplate === 'string' ? configuredTemplate : '';
    }
    this.settings.set('metube_chapter_template', this.chapterTemplate);
  }

  clipStartChanged() {
    this.settings.set('metube_clip_start', this.clipStart);
  }

  clipEndChanged() {
    this.settings.set('metube_clip_end', this.clipEnd);
  }

  // Known languages matching what has been typed, by code or name. Any code
  // can still be entered; these are suggestions.
  subtitleLanguageSuggestions(): Option[] {
    const t = (this.subtitleLanguage ?? '').toLowerCase();
    if (t === '') {
      return this.subtitleLanguages;
    }
    return this.subtitleLanguages.filter(
      l => l.id.toLowerCase().includes(t) || l.text.toLowerCase().includes(t),
    );
  }

  subtitleLanguageSearchChanged(value: string | null) {
    this.subtitleLanguage = value ?? '';
    this.subtitleLanguageChanged();
  }

  subtitleLanguageChanged() {
    this.settings.set('metube_subtitle_language', this.subtitleLanguage);
    this.saveSelection(this.downloadType);
  }

  subtitleModeChanged() {
    this.settings.set('metube_subtitle_mode', this.subtitleMode);
    this.saveSelection(this.downloadType);
  }

  ytdlOptionsPresetsChanged() {
    this.settings.set('metube_ytdl_options_presets', JSON.stringify(this.ytdlOptionsPresets ?? []));
  }

  ytdlOptionsOverridesChanged() {
    this.settings.set('metube_ytdl_options_overrides', this.ytdlOptionsOverrides);
  }

  isVideoType() {
    return this.downloadType === 'video';
  }

  formatQualityLabel(download: Download): string {
    return formatQualityLabel(download, this.downloadTypes);
  }

  downloadTypeLabel(download: Download): string {
    return downloadTypeLabel(download, this.downloadTypes);
  }

  formatLabel(download: Download): string {
    return formatLabel(download, this.downloadTypes);
  }

  formatCodecLabel(download: Download): string {
    return formatCodecLabel(download, this.downloadTypes);
  }

  queueSelectionChanged(checked: number) {
    this.queueSelectedCount = checked;
    this.cdr.markForCheck();
  }

  doneSelectionChanged(checked: number) {
    this.doneSelectedCount = checked;
    this.cdr.markForCheck();
  }

  // Each choice list is the catalog's: the selected type's formats and codecs,
  // and the selected format's qualities (empty when it has none to pick).
  setQualities() {
    const choice = this.selectedFormat()?.quality;
    this.qualities = choice?.options ?? [];
    if (choice) {
      this.quality = this.pick(choice, this.quality);
    }
  }

  refreshFormatOptions() {
    const type = this.typeEntry(this.downloadType);
    this.formatOptions = type?.format.options ?? [];
    this.codecOptions = type?.codec?.options ?? [];
  }

  currentType(): DownloadTypeOption | undefined {
    return this.typeEntry(this.downloadType);
  }

  hasSubtitleSettings(): boolean {
    const type = this.currentType();
    return !!(type?.subtitle_mode || type?.subtitle_language);
  }

  // Four fields per row are too tight at ~768px for the longer values, so a
  // four-field type goes 2×2 from md to lg and one row from lg up.
  optionColumnClass(): string {
    const type = this.currentType();
    const fields = !type ? 2 : 2
      + (type.codec ? 1 : 0)
      + (this.qualities.length ? 1 : 0)
      + (type.audio_tags ? 1 : 0)
      + (type.subtitle_language ? 1 : 0)
      + (type.subtitle_mode ? 1 : 0);
    if (fields >= 4) {
      return 'col-span-12 md:col-span-6 lg:col-span-3';
    }
    return fields === 3 ? 'col-span-12 md:col-span-4' : 'col-span-12 md:col-span-6';
  }

  // A list with a single entry is shown, but there is nothing to pick.
  hasQualityChoice(): boolean {
    return this.qualities.length > 1;
  }

  hasFormatChoice(): boolean {
    return this.formatOptions.length > 1;
  }

  private typeEntry(type: string): DownloadTypeOption | undefined {
    return this.downloadTypes.find(t => t.id === type);
  }

  private selectedFormat(): FormatOption | undefined {
    return this.typeEntry(this.downloadType)?.format.options.find(f => f.id === this.format);
  }

  // The remembered value if the choice still offers it, else the default.
  private pick(choice: Choice, value: string): string {
    return choice.options.some(o => o.id === value) ? value : choice.default;
  }

  // Runs whenever the server sends its catalog (on every connect). A changed
  // catalog, e.g. after a server upgrade, re-checks every remembered choice.
  private applyCatalog(catalog: FormatCatalog) {
    if (this.catalog && JSON.stringify(this.catalog) === JSON.stringify(catalog)) {
      return;
    }
    this.catalog = catalog;
    this.downloadTypes = catalog.download_type.options;
    const audio = this.downloadTypes.find(t => t.audio_tags);
    const captions = this.downloadTypes.find(t => t.subtitle_mode || t.subtitle_language);
    this.audioTagsOptions = audio?.audio_tags?.options ?? [];
    this.subtitleLanguages = captions?.subtitle_language?.options ?? [];
    this.subtitleModes = captions?.subtitle_mode?.options ?? [];

    this.downloadType = this.pick(catalog.download_type, this.downloadType);
    this.loadSavedSelections();
    this.restoreSelection(this.downloadType);
    this.normalizeSelectionsForType();
    this.setQualities();
    this.refreshFormatOptions();
    this.previousDownloadType = this.downloadType;
    // In memory only: checking a choice against the catalog doesn't make it
    // one the user made.
    this.saveSelection(this.downloadType, false);
  }

  // Brings the form's values in line with what the catalog offers for the
  // selected type. Fields a type doesn't have are left as they are; the
  // server ignores them for that type.
  private normalizeSelectionsForType() {
    const type = this.typeEntry(this.downloadType);
    if (!type) {
      return;
    }
    this.format = this.pick(type.format, this.format);
    if (type.codec) {
      this.codec = this.pick(type.codec, this.codec);
    }
    // Audio tags and the subtitle settings are kept across types, so they are
    // checked against the types that define them.
    const audio = this.downloadTypes.find(t => t.audio_tags);
    if (audio?.audio_tags) {
      this.audioTags = this.pick(audio.audio_tags, this.audioTags);
    }
    const captions = this.downloadTypes.find(t => t.subtitle_mode || t.subtitle_language);
    if (captions?.subtitle_mode) {
      this.subtitleMode = this.pick(captions.subtitle_mode, this.subtitleMode);
    }
    if (captions?.subtitle_language && !this.subtitleLanguage?.trim()) {
      // Any language tag is accepted; only an empty one takes the default.
      this.subtitleLanguage = captions.subtitle_language.default;
    }
    this.settings.set('metube_format', this.format);
    this.settings.set('metube_codec', this.codec);
  }

  // persist=false keeps it in memory only: the stored value marks a choice the user
  // made, and a choice not made should keep following the server defaults.
  private saveSelection(type: string, persist = true) {
    if (!type) return;
    const selection = {
      codec: this.codec,
      format: this.format,
      quality: this.quality,
      subtitleLanguage: this.subtitleLanguage,
      subtitleMode: this.subtitleMode,
    };
    this.selectionsByType[type] = selection;
    if (!persist) return;
    this.settings.set(this.selectionKeyPrefix + type, JSON.stringify(selection));
  }

  private restoreSelection(type: string) {
    const saved = this.selectionsByType[type];
    if (!saved) return;
    this.codec = saved.codec;
    this.format = saved.format;
    this.quality = saved.quality;
    this.subtitleLanguage = saved.subtitleLanguage;
    this.subtitleMode = saved.subtitleMode;
  }

  private loadSavedSelections() {
    for (const type of this.downloadTypes.map(t => t.id)) {
      const key = this.selectionKeyPrefix + type;
      if (!this.settings.has(key)) continue;
      try {
        const raw = this.settings.get(key);
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          this.selectionsByType[type] = {
            codec: String(parsed.codec ?? ''),
            format: String(parsed.format ?? ''),
            quality: String(parsed.quality ?? ''),
            subtitleLanguage: String(parsed.subtitleLanguage ?? ''),
            subtitleMode: String(parsed.subtitleMode ?? ''),
          };
        }
      } catch {
        // Ignore malformed stored values.
      }
    }
  }

  // Stored settings that hold a choice the user made on the form. A field with one
  // keeps it; every other field follows the server defaults.
  private static readonly REMEMBERED_SETTINGS = [
    'metube_download_type', 'metube_codec', 'metube_format', 'metube_quality',
    'metube_selection_video', 'metube_selection_audio', 'metube_selection_captions',
    'metube_selection_thumbnail', 'metube_auto_start', 'metube_split_chapters',
    'metube_sponsorblock', 'metube_audio_tags', 'metube_chapter_template',
    'metube_subtitle_language', 'metube_subtitle_mode', 'metube_ytdl_options_presets',
    'metube_ytdl_options_preset', 'metube_check_interval',
  ];

  // Apply the server defaults to every field that isn't a remembered choice.
  // Fields without a stored value (folder, prefix, limit, title filter, members-only)
  // take a new default only while they still hold the previous one, so an edit
  // made this session survives defaults saved from elsewhere. force applies
  // everything, for Reset to defaults.
  private applyFormDefaults(d: FormDefaults, force = false) {
    const free = (key: string) => force || !this.settings.has(key);
    const prev = this.appliedDefaults;
    const untouched = <T>(current: T, previous: T | undefined, empty: T) =>
      force || (prev ? current === previous : current === empty || current === undefined);

    const selections: Record<string, { codec: string; format: string; quality: string }> = {
      video: { codec: d.video.codec, format: d.video.format, quality: d.video.quality },
      audio: { codec: 'auto', format: d.audio.format, quality: d.audio.quality },
      captions: { codec: 'auto', format: d.captions.format, quality: 'best' },
      thumbnail: { codec: 'auto', format: 'jpg', quality: 'best' },
    };
    for (const [type, selection] of Object.entries(selections)) {
      if (free(this.selectionKeyPrefix + type)) {
        this.selectionsByType[type] = {
          ...selection,
          subtitleLanguage: d.captions.subtitle_language,
          subtitleMode: d.captions.subtitle_mode,
        };
      }
    }
    if (free('metube_download_type')) {
      this.downloadType = d.download_type;
    }
    this.restoreSelection(this.downloadType);
    this.normalizeSelectionsForType();
    this.setQualities();
    this.refreshFormatOptions();
    this.previousDownloadType = this.downloadType;

    if (free('metube_audio_tags')) this.audioTags = d.audio_tags;
    if (free('metube_auto_start')) this.autoStart = d.auto_start;
    if (free('metube_sponsorblock')) this.sponsorblock = d.sponsorblock;
    if (free('metube_split_chapters')) this.splitByChapters = d.split_by_chapters;
    if (free('metube_chapter_template') || !this.chapterTemplate) this.chapterTemplate = d.chapter_template;
    if (free('metube_ytdl_options_presets') && free('metube_ytdl_options_preset')) {
      this.ytdlOptionsPresets = [...d.ytdl_options_presets];
    }
    if (free('metube_check_interval')) this.checkIntervalMinutes = d.check_interval_minutes;

    if (untouched(this.folder, prev?.folder, '')) this.folder = d.folder;
    if (untouched(this.customNamePrefix, prev?.custom_name_prefix, '')) this.customNamePrefix = d.custom_name_prefix;
    if (untouched(this.playlistItemLimit, prev?.playlist_item_limit, 0)) this.playlistItemLimit = d.playlist_item_limit;
    if (untouched(this.titleRegex, prev?.title_regex, '')) this.titleRegex = d.title_regex;
    if (untouched(this.skipSubscriberOnly, prev?.skip_subscriber_only, false)) this.skipSubscriberOnly = d.skip_subscriber_only;

    this.appliedDefaults = d;
    this.cdr.markForCheck();
  }

  // Forget the choices remembered on the form and return it to the defaults.
  resetFormToDefaults() {
    const defaults = this.defaultsSvc.defaults();
    if (!defaults) return;
    for (const name of App.REMEMBERED_SETTINGS) {
      this.settings.remove(name);
    }
    this.selectionsByType = {};
    this.applyFormDefaults(defaults, true);
    this.toasts.success('The form is back to your defaults.');
  }

  private buildAddPayload(overrides: Partial<AddDownloadPayload> = {}): AddDownloadPayload {
    const allowYtdlOptionsOverrides = this.allowYtdlOptionsOverrides();
    return {
      url: overrides.url ?? this.addUrl,
      downloadType: overrides.downloadType ?? this.downloadType,
      codec: overrides.codec ?? this.codec,
      quality: overrides.quality ?? this.quality,
      format: overrides.format ?? this.format,
      folder: overrides.folder ?? this.folder,
      customNamePrefix: overrides.customNamePrefix ?? this.customNamePrefix,
      playlistItemLimit: overrides.playlistItemLimit ?? this.playlistItemLimit,
      autoStart: overrides.autoStart ?? this.autoStart,
      splitByChapters: overrides.splitByChapters ?? this.splitByChapters,
      sponsorblock: overrides.sponsorblock ?? this.sponsorblock,
      audioTags: overrides.audioTags ?? this.audioTags,
      chapterTemplate: overrides.chapterTemplate ?? this.chapterTemplate,
      subtitleLanguage: overrides.subtitleLanguage ?? this.subtitleLanguage,
      subtitleMode: overrides.subtitleMode ?? this.subtitleMode,
      ytdlOptionsPresets: overrides.ytdlOptionsPresets ?? [...this.ytdlOptionsPresets],
      ytdlOptionsOverrides: allowYtdlOptionsOverrides
        ? (overrides.ytdlOptionsOverrides ?? this.ytdlOptionsOverrides)
        : '',
      clipStart: overrides.clipStart ?? this.clipStart,
      clipEnd: overrides.clipEnd ?? this.clipEnd,
      videoPassword: overrides.videoPassword ?? this.videoPassword,
    };
  }

  submitAdd() {
    if (this.addInProgress) {
      return;
    }
    if (this.addMode === 'subscribe') {
      this.addSubscription();
    } else {
      this.addDownload();
    }
  }

  setAddMode(mode: 'download' | 'subscribe') {
    this.addMode = mode;
    this.clearAddError();
    this.titleRegexError = null;
    this.cdr.markForCheck();
  }

  clearAddError() {
    this.addError = null;
    this.addErrorKeptInFailed = false;
  }

  async pasteUrl() {
    let text: string;
    try {
      text = (await navigator.clipboard.readText()).trim();
    } catch {
      this.toasts.error("Couldn't read the clipboard. Allow clipboard access, or paste with the keyboard.");
      return;
    }
    if (text) {
      this.addUrl = text;
      this.clearAddError();
    }
    this.urlInput()?.nativeElement.focus();
    this.cdr.markForCheck();
  }

  // From the Subscriptions empty state: put the bar in Subscribe mode and the
  // caret in the field, scrolled into view on a phone.
  startSubscribing() {
    this.setAddMode('subscribe');
    const input = this.urlInput()?.nativeElement;
    input?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    input?.focus({ preventScroll: true });
  }

  // At a desk the next thing anyone does here is paste a link, so the field takes
  // focus once the connection enables it. Not on touch screens, where focusing
  // would pop the keyboard up over the page.
  private focusUrlWhenReady() {
    if (!window.matchMedia?.('(hover: hover) and (pointer: fine)').matches) {
      return;
    }
    // ngModel applies [disabled] a tick after rendering, so wait past it.
    const focus = () => afterNextRender(() => setTimeout(() => {
      if (!this.onSettingsPage() && document.activeElement === document.body) {
        this.urlInput()?.nativeElement.focus();
      }
    }), { injector: this.injector });
    if (!this.downloads.loading) {
      focus();
      return;
    }
    this.downloads.queueChanged
      .pipe(filter(() => !this.downloads.loading), take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe(focus);
  }

  // A link pasted while nothing editable has focus goes into the URL field, so
  // Ctrl+V works from anywhere on the page. It is not submitted.
  private onDocumentPaste = (event: ClipboardEvent) => {
    if (this.onSettingsPage() || this.downloads.loading) {
      return;
    }
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (target && (target.isContentEditable || target.closest('input, textarea, select'))) {
      return;
    }
    const text = event.clipboardData?.getData('text')?.trim();
    if (!text) {
      return;
    }
    event.preventDefault();
    this.addUrl = text;
    this.clearAddError();
    this.cdr.markForCheck();
    this.urlInput()?.nativeElement.focus();
  };

  // Puts the problem under the URL bar and the caret back in the field, with the
  // link selected so it can be replaced or fixed straight away.
  private showAddError(message: string) {
    this.addError = message;
    this.addErrorKeptInFailed = false;
    this.cdr.markForCheck();
    const input = this.urlInput()?.nativeElement;
    input?.focus();
    input?.select();
  }

  // Links the server rejects are recorded as Failed rows (for retry), and the row
  // arrives over the socket around the same time as the HTTP reply. Once it is
  // there, the message under the bar says so. Some rejections record nothing
  // (yt-dlp found nothing to add), so the note only appears for a real row.
  private noteFailedRow(url: string, message: string) {
    const recorded = () => this.downloads.done.get(url)?.status === 'error';
    const mark = () => {
      if (this.addError === message) {
        this.addErrorKeptInFailed = true;
        this.cdr.markForCheck();
      }
    };
    if (recorded()) {
      mark();
      return;
    }
    this.downloads.doneChanged
      .pipe(filter(recorded), take(1), takeUntil(timer(3000)), takeUntilDestroyed(this.destroyRef))
      .subscribe(mark);
  }

  // The busy button keeps focus while a request runs. When it finishes, the
  // next thing the user does is paste another link, so hand focus back to the
  // field unless they have already moved somewhere else.
  private restoreUrlFocus() {
    const active = document.activeElement;
    const input = this.urlInput()?.nativeElement;
    if (input && (!active || active === document.body || active.closest('[data-add-bar]'))) {
      input.focus();
    }
  }

  addDownload(overrides: Partial<AddDownloadPayload> = {}) {
    if (this.addInProgress) {
      return;
    }
    const payload = this.buildAddPayload(overrides);
    if (!payload.url?.trim()) {
      this.showAddError('Paste a link first.');
      return;
    }
    if (!this.validateAddSettings(payload)) {
      return;
    }

    this.clearAddError();
    this.addInProgress = true;
    this.cancelRequested = false;
    // The field stays editable while the link is added, so only clear what the
    // user hasn't already replaced with the next link.
    const submittedUrl = this.addUrl;
    const submittedPassword = this.videoPassword;
    this.addRequestSub?.unsubscribe();
    this.addRequestSub = this.downloads.add(payload).subscribe((status: Status) => {
      const failed = status.status === 'error' && !this.cancelRequested;
      this.resetAddState();
      if (failed) {
        const message = plainAddError(status.msg) || "Couldn't add this link.";
        this.showAddError(message);
        this.noteFailedRow(payload.url.trim(), message);
      } else if (status.status !== 'error') {
        // e.g. "Already in queue: ..." when the backend skipped a duplicate.
        if (status.msg) {
          this.toasts.info(status.msg);
        }
        if (this.addUrl === submittedUrl) {
          this.addUrl = '';
        }
        if (this.videoPassword === submittedPassword) {
          this.videoPassword = '';
        }
        this.setListView('downloading');
      }
    });
  }

  // Settings checks shared by every path that queues downloads from the form.
  private validateAddSettings(payload: AddDownloadPayload): boolean {
    // Validate chapter template if chapter splitting is enabled
    if (payload.splitByChapters && !payload.chapterTemplate.includes('%(section_number)')) {
      this.toasts.error('Chapter template must include %(section_number)');
      return false;
    }
    return this.validateYtdlOptionsOverrides(payload.ytdlOptionsOverrides);
  }

  // Probe a playlist or channel URL and let the user pick which entries to
  // queue. The picked entries are added as single downloads with the form's
  // current settings.
  browsePlaylist() {
    const url = (this.addUrl ?? '').trim();
    if (!url) {
      return;
    }
    const template = this.buildAddPayload({ url });
    if (!this.validateAddSettings(template)) {
      return;
    }
    this.browsePayload = {
      url,
      playlistItemLimit: template.playlistItemLimit,
      ytdlOptionsPresets: template.ytdlOptionsPresets,
      ytdlOptionsOverrides: template.ytdlOptionsOverrides,
    };
  }

  closeBrowse() {
    this.browsePayload = null;
    this.cdr.markForCheck();
  }

  queueBrowsedEntries(urls: string[]) {
    this.closeBrowse();
    if (!urls?.length) {
      return;
    }
    let queued = 0;
    let failed = 0;
    let firstError = '';
    from(urls).pipe(
      mergeMap(
        url => this.downloads.add(this.buildAddPayload({ url })).pipe(
          tap((status: Status) => {
            if (status.status === 'error') {
              failed++;
              firstError ||= status.msg || 'Unknown error';
            } else {
              queued++;
            }
          }),
        ),
        ADD_REQUEST_CONCURRENCY,
      ),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => {
        if (failed > 0) {
          this.toasts.error(`Queued ${queued} of ${urls.length}; ${failed} failed: ${firstError}`);
        } else if (queued > 0) {
          this.toasts.info(`Queued ${queued} ${queued === 1 ? 'item' : 'items'}`);
        }
        this.cdr.markForCheck();
      }),
    ).subscribe();
  }

  cancelAdding() {
    this.cancelRequested = true;
    this.downloads.cancelAdd().subscribe({
      next: () => {
        this.addRequestSub?.unsubscribe();
        this.resetAddState();
      },
      error: (err) => {
        this.cancelRequested = false;
        console.error('Failed to cancel adding:', err?.message || err);
      }
    });
  }

  private resetAddState() {
    this.addRequestSub = undefined;
    this.addInProgress = false;
    this.cancelRequested = false;
    this.restoreUrlFocus();
    this.cdr.markForCheck();
  }

  downloadItemByKey(id: string) {
    this.downloads.startById([id]).subscribe((res) => this.handleActionResult(res, 'Start download failed'));
  }

  isIndeterminate(download: Download): boolean {
    return isIndeterminate(download);
  }

  private syncLiveCountdownTimer() {
    const hasScheduled = Array.from(this.downloads.queue.values()).some(
      (download) => download.status === 'scheduled',
    );
    if (hasScheduled && !this.liveCountdownTimer) {
      this.liveCountdownTimer = setInterval(() => {
        this.now = Date.now();
        this.cdr.markForCheck();
      }, 1000);
    } else if (!hasScheduled && this.liveCountdownTimer) {
      clearInterval(this.liveCountdownTimer);
      this.liveCountdownTimer = undefined;
    }
  }

  retryDownload(key: string, download: Download) {
    this.retryRequest(key, download).pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
  }

  private retryRequest(key: string, download: Download): Observable<Status> {
    // Only remove the done-list record once the retry is confirmed queued —
    // deleting it eagerly would silently lose history if the re-add fails.
    return this.downloads.retry(key).pipe(
      tap((status: Status) => {
        if (status.status === 'error') {
          this.toasts.error(`Error retrying ${download.title}: ${status.msg}`);
          this.cdr.markForCheck();
          return;
        }
        this.downloads.delById('done', [key]).subscribe();
      }),
    );
  }

  // In ask mode (DELETE_FILE_ON_TRASHCAN='ask'), completed entries may still have
  // a file on disk, so the user is asked whether to keep or delete it before the
  // list entry is removed. Returns undefined when no prompt is needed (send no
  // flag), false/true for the user's choice, or null when the user cancelled.
  private asksBeforeDeletingFiles(where: State, ids: string[]): boolean {
    return where === 'done' &&
      this.downloads.configuration['DELETE_FILE_ON_TRASHCAN'] === 'ask' &&
      ids.some((id) => {
        const dl = this.downloads.done.get(id);
        return !!dl?.filename || !!dl?.chapter_files?.length;
      });
  }

  private async confirmFileDeletion(where: State, ids: string[]): Promise<boolean | null | undefined> {
    if (
      where !== 'done' ||
      this.downloads.configuration['DELETE_FILE_ON_TRASHCAN'] !== 'ask' ||
      ids.length === 0
    ) {
      return undefined;
    }
    if (!this.asksBeforeDeletingFiles(where, ids)) {
      return false;
    }
    const message = ids.length === 1
      ? `Remove "${this.downloads.done.get(ids[0])?.title ?? ids[0]}" from the list? You can also delete its file from disk.`
      : `Remove ${ids.length} items from the list? You can also delete their files from disk.`;
    return await this.toasts.choose<boolean | null>(message, [
      { label: 'Cancel', value: null },
      { label: 'Remove from list', value: false },
      { label: 'Delete files', value: true, primary: true },
    ]);
  }

  // ids are collected before the prompt is shown: the user's choice applies to
  // that snapshot, so entries that finish (or otherwise change) while the
  // prompt is open must not get swept into the delete along with it.
  private async removeDownloads(where: State, ids: string[], errorMsg: string) {
    const deleteFiles = await this.confirmFileDeletion(where, ids);
    if (deleteFiles === null) {
      return;
    }
    this.downloads.delById(where, ids, deleteFiles).subscribe((res) => this.handleActionResult(res, errorMsg));
    this.cdr.markForCheck();
  }

  async delDownload(where: State, id: string) {
    await this.removeDownloads(where, [id], 'Delete failed');
  }

  startAllPending() {
    this.downloads.startByFilter('queue', dl => dl.status === 'pending').subscribe((res) => this.handleActionResult(res, 'Start download failed'));
  }

  startSelectedDownloads(where: State){
    this.downloads.startByFilter(where, dl => !!dl.checked).subscribe((res) => this.handleActionResult(res, 'Start download failed'));
  }

  async delSelectedDownloads(where: State) {
    const ids: string[] = [];
    this.downloads[where].forEach((dl: Download, key: string) => { if (dl.checked) ids.push(key); });
    await this.removeDownloads(where, ids, 'Delete failed');
  }

  async clearCompletedDownloads() {
    const ids: string[] = [];
    this.downloads.done.forEach((dl, key) => { if (dl.status === 'finished') ids.push(key); });
    await this.removeDownloads('done', ids, 'Clear completed failed');
  }

  // A failed row holds the only copy of its URL, and Clear failed sits next to
  // Retry failed, so it asks first (#1094). When ask mode is about to prompt
  // for leftover files anyway, that prompt (which has Cancel) is the question.
  async clearFailedDownloads() {
    const ids: string[] = [];
    this.downloads.done.forEach((dl, key) => { if (dl.status === 'error') ids.push(key); });
    if (ids.length === 0) {
      return;
    }
    if (!this.asksBeforeDeletingFiles('done', ids)) {
      const count = ids.length === 1 ? 'the failed download' : `${ids.length} failed downloads`;
      const confirmed = await this.toasts.confirm(
        `Clear ${count}? ${ids.length === 1 ? 'Its URL is' : 'Their URLs are'} not kept anywhere else, ` +
        'so retrying later means finding them again.',
        'Clear',
        'Cancel',
      );
      if (!confirmed) {
        return;
      }
    }
    await this.removeDownloads('done', ids, 'Clear failed downloads failed');
  }

  // Each retry is a full yt-dlp extraction on the server, so a long failed
  // list goes out a few at a time rather than all at once.
  retryFailedDownloads() {
    const failed: [string, Download][] = [];
    this.downloads.done.forEach((dl, key) => {
      if (dl.status === 'error') {
        failed.push([key, dl]);
      }
    });
    from(failed).pipe(
      mergeMap(([key, dl]) => this.retryRequest(key, dl), ADD_REQUEST_CONCURRENCY),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe();
  }

  // Chromium-based browsers silently drop programmatic downloads beyond ~10 when
  // triggered in a tight loop. Trigger in batches with a short pause in between so
  // large selections download cleanly. See issue #1008.
  private static readonly DOWNLOAD_BATCH_SIZE = 10;
  private static readonly DOWNLOAD_BATCH_DELAY_MS = 1000;

  async downloadSelectedFiles() {
    const selected: Download[] = [];
    this.downloads.done.forEach((dl) => {
      if (dl.status === 'finished' && dl.checked) {
        selected.push(dl);
      }
    });

    for (let i = 0; i < selected.length; i++) {
      const dl = selected[i];
      const link = document.createElement('a');
      link.href = this.buildDownloadLink(dl);
      link.setAttribute('download', dl.filename);
      link.setAttribute('target', '_self');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      if (
        (i + 1) % App.DOWNLOAD_BATCH_SIZE === 0 &&
        i + 1 < selected.length
      ) {
        await new Promise((resolve) =>
          setTimeout(resolve, App.DOWNLOAD_BATCH_DELAY_MS),
        );
      }
    }
  }

  buildDownloadLink(download: Download) {
    return buildDownloadLink(this.downloads.configuration, download);
  }

  // Web Share API support — primarily for iOS Safari / Chrome, lets the user
  // hand the downloaded file off to the platform share sheet (Photos.app,
  // Files, third-party apps, AirDrop). Falls back silently to the standard
  // download flow on platforms without navigator.share / canShare.
  canShareDownloads(): boolean {
    // navigator.share alone is not enough — Desktop Safari implements
    // navigator.share but not canShare with files. We explicitly require
    // both, since we always intend to share a file (not a URL).
    return typeof navigator !== 'undefined'
      && typeof navigator.share === 'function'
      && typeof navigator.canShare === 'function';
  }

  // Conservative warning threshold for the share sheet — iOS' actual
  // refusal limit varies between ~50 MB (older versions) and ~150 MB
  // (recent ones). 80 MB warns the user before the time-wasting fetch+
  // copy of a too-large file that the platform will then reject.
  private static readonly SHARE_SIZE_WARN_BYTES = 80 * 1024 * 1024;

  async shareDownload(download: Download): Promise<void> {
    if (!this.canShareDownloads()) {
      return;
    }
    // Pre-flight size check: warn the user about the iOS share-sheet
    // soft-fail on large files, before we spend time fetching the whole
    // file into memory only to have navigator.canShare reject it.
    if (download.size && download.size > App.SHARE_SIZE_WARN_BYTES) {
      const sizeMb = Math.round(download.size / 1024 / 1024);
      const proceed = await this.toasts.confirm(
        `This file is ${sizeMb} MB. iOS' share sheet often refuses files ` +
        `larger than ~100 MB and the share will silently fail. ` +
        `Try anyway? (Use the download button instead if it fails.)`,
        'Try anyway',
        'Cancel',
      );
      if (!proceed) return;
    }
    try {
      const response = await fetch(this.buildDownloadLink(download));
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} fetching file for share`);
      }
      const blob = await response.blob();
      const file = new File([blob], download.filename, {
        type: blob.type || 'application/octet-stream',
      });
      const payload: ShareData = { files: [file], title: download.title };
      if (!navigator.canShare(payload)) {
        // The platform refused the payload — most commonly because the
        // file is too large for the iOS share sheet, or the MIME type
        // isn't accepted. Tell the user so they can fall back to the
        // download button right next to this one instead of staring at
        // a button that quietly did nothing.
        console.warn('navigator.canShare rejected payload for', download.filename);
        this.toasts.error(
          `Your device's share sheet doesn't accept this file ` +
          `(most likely because it's too large). ` +
          `Please use the download button instead.`
        );
        return;
      }
      await navigator.share(payload);
    } catch (err) {
      const e = err as { name?: string; message?: string };
      // AbortError = user dismissed the share sheet → silent no-op.
      if (e.name === 'AbortError') return;
      console.error('Share failed:', err);
      this.toasts.error(
        `Share failed: ${e.message || 'unknown error'}. ` +
        `Please use the download button instead.`
      );
    }
  }

  buildChapterDownloadLink(download: Download, chapterFilename: string) {
    return buildChapterDownloadLink(this.downloads.configuration, download, chapterFilename);
  }

  // Keeps the non-negative integer fields to digits. Only a typed character
  // is filtered: named keys (Enter, Tab, arrows, Escape, F-keys) and anything
  // with a modifier pass, so Enter submits and Ctrl/Cmd+A/C/V/X/Z still work.
  // An allowlist of named keys used to block all of those.
  digitsOnly(event: KeyboardEvent) {
    if (event.ctrlKey || event.metaKey || event.altKey || event.key.length !== 1) {
      return;
    }
    if (!/^[0-9]$/.test(event.key)) {
      event.preventDefault();
    }
  }

  // Toggle inline batch panel (if you want to use an inline panel for export; not used for import modal)
  toggleBatchPanel(): void {
    this.showBatchPanel = !this.showBatchPanel;
  }

  // Open the Batch Import modal
  openBatchImportModal(): void {
    this.lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.batchImportModalOpen = true;
    this.batchImportText = '';
    this.batchImportStatus = '';
    this.batchImportCount = 0;
    this.batchImportTotal = 0;
    this.batchImportFailures = 0;
    this.importInProgress = false;
    setTimeout(() => {
      const textarea = document.getElementById('batch-import-textarea');
      if (textarea instanceof HTMLTextAreaElement) {
        textarea.focus();
      }
    }, 0);
  }

  // Close the Batch Import modal
  closeBatchImportModal(): void {
    this.batchImportModalOpen = false;
    this.lastFocusedElement?.focus();
  }

  // Start importing URLs from the batch modal textarea
  startBatchImport(): void {
    const urls = this.batchImportText
      .split(/\r?\n/)
      .map(url => url.trim())
      .filter(url => url.length > 0);
    if (urls.length === 0) {
      this.toasts.error('No valid URLs found.');
      return;
    }
    this.importInProgress = true;
    this.batchImportCount = 0;
    this.batchImportFailures = 0;
    this.batchImportTotal = urls.length;
    this.updateBatchImportStatus();

    from(urls).pipe(
      mergeMap(
        url => this.downloads.add(this.buildAddPayload({ url })).pipe(
          // downloads.add() already catches HTTP errors and emits a single
          // Status value, so `tap` (not `finalize`) is the right place to
          // count. This avoids incrementing the counter when an in-flight
          // request is aborted by cancellation.
          tap((status: Status) => {
            if (status.status === 'error') {
              this.batchImportFailures++;
              console.error(`Error adding URL ${url}: ${status.msg}`);
            }
            this.batchImportCount++;
            this.updateBatchImportStatus();
            this.cdr.markForCheck();
          }),
        ),
        ADD_REQUEST_CONCURRENCY,
      ),
      takeUntil(this.batchImportCancel$),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => {
        this.importInProgress = false;
        this.updateBatchImportStatus(true);
        this.cdr.markForCheck();
      }),
    ).subscribe();
  }

  private updateBatchImportStatus(done = false): void {
    const parts: string[] = [];
    if (done) {
      const processed = this.batchImportCount;
      if (processed < this.batchImportTotal) {
        parts.push(`Import cancelled after ${processed} of ${this.batchImportTotal} URLs.`);
      } else {
        parts.push(`Finished importing ${this.batchImportTotal} URLs.`);
      }
    } else {
      parts.push(`Importing ${this.batchImportCount} of ${this.batchImportTotal} URLs...`);
    }
    if (this.batchImportFailures > 0) {
      parts.push(`${this.batchImportFailures} failed.`);
    }
    this.batchImportStatus = parts.join(' ');
  }

  // Cancel the batch import process: aborts in-flight and pending requests
  // immediately via the cancellation Subject wired into the pipeline.
  cancelBatchImport(): void {
    if (this.importInProgress) {
      this.batchImportCancel$.next();
    }
  }

  // Export URLs based on filter: 'pending', 'completed', 'failed', or 'all'
  exportBatchUrls(filter: BatchUrlFilter): void {
    this.batchUrls.export(filter);
  }

  // Copy URLs to clipboard based on filter: 'pending', 'completed', 'failed', or 'all'
  copyBatchUrls(filter: BatchUrlFilter): void {
    this.batchUrls.copy(filter);
  }

  fetchVersionInfo(): void {
    // Relative, like every other API call, so it follows URL_PREFIX.
    this.http.get<{ 'yt-dlp': string, version: string }>('version')
      .subscribe({
        next: (data) => {
          this.ytDlpVersion = data['yt-dlp'];
          this.metubeVersion = data.version;
          this.cdr.markForCheck();
        },
        error: () => {
          this.ytDlpVersion = null;
          this.metubeVersion = null;
          this.cdr.markForCheck();
        }
      });
  }

  toggleSortOrder() {
    this.sortAscending = !this.sortAscending;
    this.settings.set('metube_sort_ascending', this.sortAscending ? 'true' : 'false');
    this.rebuildSortedDone();
  }

  setListView(view: ListView) {
    if (view === this.listView) {
      return;
    }
    this.listView = view;
    this.settings.set('metube_list_view', view);
    // A selection only means something in the view it was made in: the bulk
    // actions act on every checked row, and hidden rows would go with them.
    this.clearSelections();
    this.rebuildSortedDone();
    this.cdr.markForCheck();
    afterNextRender(() => this.revealActivePill(), { injector: this.injector });
  }

  // On a phone the pill row scrolls sideways with its scrollbar hidden, so a view
  // switched in code (after adding, or restored from storage) could leave the
  // active pill out of sight. Scroll the row, never the page.
  private revealActivePill() {
    const row = this.listViews()?.nativeElement;
    const pill = row?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!row || !pill || row.scrollWidth <= row.clientWidth) {
      return;
    }
    const rowBox = row.getBoundingClientRect();
    const pillBox = pill.getBoundingClientRect();
    if (pillBox.left < rowBox.left || pillBox.right > rowBox.right - 32) {
      row.scrollBy({ left: pillBox.left - rowBox.left - 12, behavior: 'smooth' });
    }
  }

  private trackEnteringQueueRows() {
    const ids = new Set(this.downloads.queue.keys());
    const known = this.knownQueueIds;
    this.knownQueueIds = ids;
    if (!known) {
      return;
    }
    const added = [...ids].filter(id => !known.has(id));
    if (added.length === 0) {
      return;
    }
    added.forEach(id => this.enteringQueueIds.add(id));
    // Dropped once the animation has played, so a row remounted by a later
    // view switch doesn't play it again.
    setTimeout(() => {
      added.forEach(id => this.enteringQueueIds.delete(id));
      this.cdr.markForCheck();
    }, App.QUEUE_ROW_ENTER_MS);
  }

  private clearSelections() {
    this.downloads.queue.forEach(dl => { dl.checked = false; });
    this.downloads.done.forEach(dl => { dl.checked = false; });
    this.selectedSubscriptionIds.clear();
    this.queueSelectedCount = 0;
    this.doneSelectedCount = 0;
  }

  private rebuildSortedDone() {
    const failedView = this.listView === 'failed';
    const result: [string, Download][] = [];
    this.downloads.done.forEach((dl, key) => {
      if ((dl.status === 'error') === failedView) {
        result.push([key, dl]);
      }
    });
    if (!this.sortAscending) {
      result.reverse();
    }
    this.cachedSortedDone = result;
    this.cachedVisibleDone = new Map(result);
    this.cachedSortedDoneIds = result.map(([key]) => key);
  }

  toggleErrorDetail(id: string) {
    if (this.expandedErrors.has(id)) this.expandedErrors.delete(id);
    else this.expandedErrors.add(id);
  }

  copyErrorMessage(id: string, download: Download) {
    const parts: string[] = [];
    if (download.title) parts.push(`Title: ${download.title}`);
    if (download.url) parts.push(`URL: ${download.url}`);
    if (download.msg) parts.push(`Message: ${download.msg}`);
    if (download.error) parts.push(`Error: ${download.error}`);
    const text = parts.join('\n');
    if (!text.trim()) return;
    const done = () => {
      this.lastCopiedErrorId = id;
      this.cdr.markForCheck();
      setTimeout(() => {
        this.lastCopiedErrorId = null;
        this.cdr.markForCheck();
      }, 1500);
    };
    const fail = (err?: unknown) => {
      console.error('Clipboard write failed:', err);
      this.toasts.error('Failed to copy to clipboard. Your browser may require HTTPS for clipboard access.');
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(fail);
    } else {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        done();
      } catch (e) {
        fail(e);
      }
    }
  }

  isErrorExpanded(id: string): boolean {
    return this.expandedErrors.has(id);
  }

  onCookieFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    this.cookieUploadInProgress = true;
    this.cdr.markForCheck();
    this.downloads.uploadCookies(input.files[0]).subscribe({
      next: (response) => {
        if (response?.status === 'ok') {
          this.hasCookies = true;
        } else {
          this.refreshCookieStatus();
          this.toasts.error(`Error uploading cookies: ${this.formatErrorMessage(response?.msg)}`);
        }
        this.cookieUploadInProgress = false;
        input.value = '';
        this.cdr.markForCheck();
      },
      error: () => {
        this.refreshCookieStatus();
        this.cookieUploadInProgress = false;
        input.value = '';
        this.toasts.error('Error uploading cookies.');
        this.cdr.markForCheck();
      }
    });
  }

  private formatErrorMessage(error: unknown): string {
    if (typeof error === 'string') {
      return error;
    }
    if (error && typeof error === 'object') {
      const obj = error as Record<string, unknown>;
      for (const key of ['msg', 'reason', 'error', 'detail']) {
        const value = obj[key];
        if (typeof value === 'string' && value.trim()) {
          return value;
        }
      }
      try {
        return JSON.stringify(error);
      } catch {
        return 'Unknown error';
      }
    }
    return 'Unknown error';
  }

  deleteCookies() {
    this.downloads.deleteCookies().subscribe({
      next: (response) => {
        if (response?.status === 'ok') {
          this.refreshCookieStatus();
          return;
        }
        this.refreshCookieStatus();
        this.toasts.error(`Error deleting cookies: ${this.formatErrorMessage(response?.msg)}`);
      },
      error: () => {
        this.refreshCookieStatus();
        this.toasts.error('Error deleting cookies.');
      }
    });
  }

  private refreshCookieStatus() {
    this.downloads.getCookieStatus().subscribe(data => {
      this.hasCookies = !!(data && typeof data === 'object' && 'has_cookies' in data && data.has_cookies);
      this.cdr.markForCheck();
    });
  }

  private updateQueueMetrics() {
    let active = 0;
    let queued = 0;
    let pending = 0;
    let speed = 0;

    this.downloads.queue.forEach((download) => {
      if (download.status === 'downloading') {
        active++;
        speed += download.speed || 0;
      } else if (download.status === 'preparing' || download.status === 'postprocessing') {
        active++;
      } else if (download.status === 'queued' || download.status === 'pending' || download.status === 'scheduled') {
        queued++;
        if (download.status === 'pending') {
          pending++;
        }
      }
    });

    this.activeDownloads = active;
    this.queuedDownloads = queued;
    this.pendingDownloads = pending;
    this.totalSpeed = speed;
  }

  private updateDoneMetrics() {
    let completed = 0;
    let failed = 0;

    this.downloads.done.forEach((download) => {
      if (download.status === 'finished') {
        completed++;
      } else if (download.status === 'error') {
        failed++;
      }
    });

    this.completedDownloads = completed;
    this.failedDownloads = failed;
    // Clear completed / Clear failed / Retry failed act on exactly these rows.
    this.hasCompletedDone = completed > 0;
    this.hasFailedDone = failed > 0;
  }
}

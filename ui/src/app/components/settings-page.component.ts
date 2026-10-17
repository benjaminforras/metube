import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  effect,
  inject,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { HlmAutocompleteImports } from '@spartan-ng/helm/autocomplete';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmComboboxImports } from '@spartan-ng/helm/combobox';
import { HlmInputGroupImports } from '@spartan-ng/helm/input-group';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { HlmSwitchImports } from '@spartan-ng/helm/switch';
import { DownloadTypeOption, FormDefaults, FormatOption, Option } from '../interfaces';
import { DefaultsService, DownloadsService, ToastService } from '../services';
import { GROUP_SELECT_TRIGGER_CLASS, optionLabel } from '../form-options';
import { HelpLabelComponent } from './help-label.component';

function copy(values: FormDefaults): FormDefaults {
  return structuredClone(values);
}

// Edits the download form's defaults, which the server stores for every
// browser. The page works on a draft; nothing changes until Save.
@Component({
  selector: 'app-settings-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    RouterLink,
    FontAwesomeModule,
    HlmAutocompleteImports,
    HlmButtonImports,
    HlmComboboxImports,
    HlmInputGroupImports,
    HlmSelectImports,
    HlmSpinnerImports,
    HlmSwitchImports,
    HelpLabelComponent,
  ],
  templateUrl: './settings-page.component.html',
  styles: `
    :host { display: block; }
    .settings-page { max-width: 960px; margin: 2.5rem auto 0; }
    .settings-section { display: grid; gap: 1rem; padding: 1.75rem 0; border-top: 1px solid var(--border); }
    .settings-section:first-of-type { border-top: 0; padding-top: 0.5rem; }
    .settings-section-heading { font-size: 0.8rem; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; }
    .settings-actions {
      position: sticky; bottom: 0; z-index: 10;
      display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem;
      margin-top: 1rem; padding: 0.875rem 0;
      border-top: 1px solid var(--border); background: var(--background);
    }
  `,
})
export class SettingsPageComponent {
  private defaultsSvc = inject(DefaultsService);
  private downloads = inject(DownloadsService);
  private toasts = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);

  readonly faArrowLeft = faArrowLeft;
  readonly groupSelectClass = GROUP_SELECT_TRIGGER_CLASS;

  // The option lists are the server's catalog (app/format_catalog.py), the
  // same one the download form uses; the page waits for it.
  get downloadTypes(): DownloadTypeOption[] {
    return this.downloads.formats?.download_type.options ?? [];
  }
  get videoCodecs(): Option[] {
    return this.type('video')?.codec?.options ?? [];
  }
  get videoFormats(): FormatOption[] {
    return this.type('video')?.format.options ?? [];
  }
  get audioFormats(): FormatOption[] {
    return this.type('audio')?.format.options ?? [];
  }
  get audioTags(): Option[] {
    return this.type('audio')?.audio_tags?.options ?? [];
  }
  get captionFormats(): FormatOption[] {
    return this.type('captions')?.format.options ?? [];
  }
  get subtitleModes(): Option[] {
    return this.type('captions')?.subtitle_mode?.options ?? [];
  }

  readonly downloadTypeText = optionLabel(() => this.downloadTypes);
  readonly codecText = optionLabel(() => this.videoCodecs);
  readonly videoFormatText = optionLabel(() => this.videoFormats);
  readonly videoQualityText = optionLabel(() => this.videoQualities());
  readonly audioFormatText = optionLabel(() => this.audioFormats);
  readonly audioQualityText = optionLabel(() => this.audioQualities());
  readonly audioTagsText = optionLabel(() => this.audioTags);
  readonly captionFormatText = optionLabel(() => this.captionFormats);
  readonly subtitleModeText = optionLabel(() => this.subtitleModes);
  readonly autoStartText = (value: unknown) => (value ? 'Yes' : 'No');

  // null until the server has sent the current defaults.
  draft: FormDefaults | null = null;
  private saved: FormDefaults | null = null;
  saving = false;
  presetNames: string[] = [];

  constructor() {
    effect(() => {
      const current = this.defaultsSvc.defaults();
      if (!current) return;
      untracked(() => {
        // Another page or device saved: take its values, unless that would
        // throw away edits made here.
        const keepDraft = this.dirty();
        this.saved = copy(current);
        if (!keepDraft) {
          this.draft = copy(current);
        }
        this.cdr.markForCheck();
      });
    });
    this.downloads.getPresets().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((data) => {
      this.presetNames = Array.isArray(data?.presets) ? data.presets : [];
      this.cdr.markForCheck();
    });
    // Folder suggestions and whether folders apply at all arrive over the socket.
    this.downloads.configurationChanged.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.cdr.markForCheck());
    this.downloads.customDirsChanged.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.cdr.markForCheck());
    this.downloads.formatsChanged.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.cdr.markForCheck());
  }

  dirty(): boolean {
    return !!this.draft && !!this.saved && JSON.stringify(this.draft) !== JSON.stringify(this.saved);
  }

  customDirsEnabled(): boolean {
    return !!this.downloads.configuration['CUSTOM_DIRS'];
  }

  private type(id: string): DownloadTypeOption | undefined {
    return this.downloadTypes.find(t => t.id === id);
  }

  videoQualities(): Option[] {
    return this.videoFormats.find(f => f.id === this.draft?.video.format)?.quality?.options ?? [];
  }

  audioQualities(): Option[] {
    return this.audioFormats.find(f => f.id === this.draft?.audio.format)?.quality?.options ?? [];
  }

  videoFormatChanged() {
    if (this.draft && !this.videoQualities().some(q => q.id === this.draft!.video.quality)) {
      this.draft.video.quality = this.videoFormats.find(f => f.id === this.draft!.video.format)?.quality?.default ?? 'best';
    }
  }

  audioFormatChanged() {
    if (this.draft && !this.audioQualities().some(q => q.id === this.draft!.audio.quality)) {
      this.draft.audio.quality = this.audioFormats.find(f => f.id === this.draft!.audio.format)?.quality?.default ?? 'best';
    }
  }

  folderSuggestions(): string[] {
    const dirs = this.downloads.customDirs ?? {};
    const all = [...new Set([...(dirs['download_dir'] ?? []), ...(dirs['audio_download_dir'] ?? [])])];
    const t = (this.draft?.folder ?? '').toLowerCase();
    return (t === '' ? all : all.filter(d => d.toLowerCase().includes(t))).slice(0, 10);
  }

  private subtitleLanguages(): Option[] {
    return this.type('captions')?.subtitle_language?.options ?? [];
  }

  languageSuggestions(): Option[] {
    const t = (this.draft?.captions.subtitle_language ?? '').toLowerCase();
    if (t === '') {
      return this.subtitleLanguages();
    }
    return this.subtitleLanguages().filter(l => l.id.toLowerCase().includes(t) || l.text.toLowerCase().includes(t));
  }

  save() {
    if (!this.draft || this.saving) return;
    this.saving = true;
    this.defaultsSvc.save(this.draft).subscribe({
      next: (saved) => {
        this.saved = copy(saved);
        this.draft = copy(saved);
        this.saving = false;
        this.toasts.success('Defaults saved.');
        this.cdr.markForCheck();
      },
      error: (err: Error) => {
        this.saving = false;
        this.toasts.error(`Couldn't save the defaults: ${err.message}`);
        this.cdr.markForCheck();
      },
    });
  }

  discard() {
    if (this.saved) {
      this.draft = copy(this.saved);
    }
  }

  async restoreBuiltIn() {
    const confirmed = await this.toasts.confirm(
      'Restore the built-in defaults? This replaces the defaults saved here for every browser.',
      'Restore',
      'Cancel',
    );
    if (!confirmed) return;
    this.defaultsSvc.reset().subscribe({
      next: (saved) => {
        this.saved = copy(saved);
        this.draft = copy(saved);
        this.toasts.success('Built-in defaults restored.');
        this.cdr.markForCheck();
      },
      error: (err: Error) => {
        this.toasts.error(`Couldn't restore the defaults: ${err.message}`);
        this.cdr.markForCheck();
      },
    });
  }

  // Route guard: leaving with unsaved edits asks first.
  async confirmLeave(): Promise<boolean> {
    if (!this.dirty()) return true;
    return this.toasts.confirm('Leave without saving your changes to the defaults?', 'Leave', 'Stay');
  }
}

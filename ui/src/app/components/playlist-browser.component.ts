import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  inject,
  input,
  output,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HlmAlertImports } from '@spartan-ng/helm/alert';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { BrowseEntry, BrowsePayload, DownloadsService } from '../services/downloads.service';
import { Checkable } from '../interfaces';
import { SelectAllCheckboxComponent } from './master-checkbox.component';
import { ItemCheckboxComponent } from './slave-checkbox.component';

type BrowseRow = BrowseEntry & Checkable;

/**
 * Lists the entries of a playlist or channel (a flat probe, no downloading)
 * inside the opener's dialog, and emits the URLs the user ticked.
 */
@Component({
  selector: 'app-playlist-browser',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    HlmAlertImports,
    HlmBadgeImports,
    HlmButtonImports,
    HlmDialogImports,
    HlmSpinnerImports,
    HlmTableImports,
    SelectAllCheckboxComponent,
    ItemCheckboxComponent,
  ],
  host: { class: 'contents' },
  template: `
    <hlm-dialog-header>
      <h3 hlmDialogTitle class="break-words">
        @if (loaded) {
          {{ playlistTitle || 'Pick from a playlist' }}
          <span class="text-muted-foreground ms-1 text-sm font-normal">
            ({{ rows.size }} {{ rows.size === 1 ? 'entry' : 'entries' }})
          </span>
        } @else {
          Pick from a playlist
        }
      </h3>
      <p hlmDialogDescription>Ticked videos are queued with the options on the form.</p>
    </hlm-dialog-header>
    <div class="max-h-[60vh] min-h-24 overflow-y-auto">
      @if (loading) {
        <p class="text-muted-foreground flex items-center gap-2 text-sm" role="status">
          <hlm-spinner class="text-sm" /> Loading entries…
        </p>
      } @else if (errorMsg) {
        <div hlmAlert variant="destructive" role="alert">
          <div hlmAlertDescription>{{ errorMsg }}</div>
        </div>
      } @else if (rows.size === 0) {
        <p class="text-muted-foreground text-sm">No entries found.</p>
      } @else {
        <table hlmTable class="tabular-nums">
          <thead hlmTHead>
            <tr hlmTr>
              <th hlmTh class="w-4">
                <app-select-all-checkbox
                  #browseMaster
                  [id]="'browse'"
                  [list]="rows"
                  (changed)="selectionChanged($event)"
                />
              </th>
              <th hlmTh>Title</th>
              <th hlmTh class="w-24 text-end">Duration</th>
            </tr>
          </thead>
          <tbody hlmTBody>
            @for (row of rowList; track row[0]) {
              <tr hlmTr>
                <td hlmTd>
                  <app-item-checkbox [id]="row[0]" [master]="browseMaster" [checkable]="row[1]" />
                </td>
                <td hlmTd class="whitespace-normal break-words">
                  <a [href]="row[1].url" target="_blank" rel="noopener noreferrer" class="hover:underline">{{
                    row[1].title || row[1].url
                  }}</a>
                  @if (isDownloaded(row[1])) {
                    <span hlmBadge variant="secondary" class="ms-2">Downloaded</span>
                  }
                </td>
                <td hlmTd class="text-end whitespace-nowrap">{{ formatDuration(row[1].duration) }}</td>
              </tr>
            }
          </tbody>
        </table>
      }
    </div>
    <hlm-dialog-footer>
      <button type="button" hlmBtn variant="outline" (click)="canceled.emit()">Cancel</button>
      <button type="button" hlmBtn [disabled]="!loaded || selectedCount === 0" (click)="addSelected()">
        Download selected ({{ selectedCount }})
      </button>
    </hlm-dialog-footer>
  `,
})
export class PlaylistBrowserComponent implements OnInit {
  private downloads = inject(DownloadsService);
  private cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);

  readonly payload = input.required<BrowsePayload>();
  readonly picked = output<string[]>();
  readonly canceled = output<void>();

  loading = true;
  loaded = false;
  errorMsg = '';
  playlistTitle = '';
  selectedCount = 0;
  // Keyed by list position, so entries that repeat a URL stay visible and the
  // checkbox DOM ids stay clean.
  rows = new Map<string, BrowseRow>();
  rowList: [string, BrowseRow][] = [];

  ngOnInit(): void {
    this.downloads
      .browse(this.payload())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        this.loading = false;
        if (result.status === 'error') {
          this.errorMsg = result.msg || 'Failed to load entries';
        } else {
          this.playlistTitle = result.title ?? '';
          this.rows = new Map(
            (result.entries ?? []).map((entry, index) => [
              String(index),
              { ...entry, checked: false },
            ]),
          );
          this.rowList = Array.from(this.rows);
          this.loaded = true;
        }
        this.cdr.markForCheck();
      });
  }

  selectionChanged(count: number): void {
    this.selectedCount = count;
    this.cdr.markForCheck();
  }

  isDownloaded(entry: BrowseEntry): boolean {
    return this.downloads.done.get(entry.url)?.status === 'finished';
  }

  formatDuration(seconds: number | null): string {
    if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds < 0) {
      return '';
    }
    const total = Math.round(seconds);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = String(total % 60).padStart(2, '0');
    return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
  }

  addSelected(): void {
    const urls = new Set<string>();
    this.rows.forEach((row) => {
      if (row.checked) {
        urls.add(row.url);
      }
    });
    this.picked.emit(Array.from(urls));
  }
}

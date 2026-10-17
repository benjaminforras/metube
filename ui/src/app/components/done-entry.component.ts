import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import {
  faCheckCircle,
  faChevronRight,
  faCopy,
  faDownload,
  faExternalLinkAlt,
  faRedoAlt,
  faShareNodes,
  faTimesCircle,
  faTrashAlt,
} from '@fortawesome/free-solid-svg-icons';
import { HlmAlertImports } from '@spartan-ng/helm/alert';
import { buttonVariants } from '@spartan-ng/helm/button';
import { Download, DownloadTypeOption } from '../interfaces';
import { FileSizePipe } from '../pipes';
import {
  buildChapterDownloadLink,
  buildDownloadLink,
  chapterFileName,
  downloadTypeLabel,
  formatCodecLabel,
  formatQualityLabel,
  resultItemTooltip,
} from '../download-display';
import { ItemCheckboxComponent } from './slave-checkbox.component';
import { SelectAllCheckboxComponent } from './master-checkbox.component';

// One entry of the Completed table: its row plus one row per chapter file,
// grouped in their own <tbody> (a table may have several). OnPush so download
// progress, which never touches the completed list, doesn't re-render the
// whole history on every tick.
@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'tbody[app-done-entry]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    FontAwesomeModule,
    HlmAlertImports,
    FileSizePipe,
    ItemCheckboxComponent,
  ],
  template: `
    <tr class="hover:bg-muted/50 border-b transition-colors" [class.opacity-50]="deleting()" [class.pointer-events-none]="deleting()">
      <td class="p-2 align-middle whitespace-nowrap">
        <app-item-checkbox [id]="id()" [master]="master()" [checkable]="download()" />
      </td>
      <td class="p-2 align-middle whitespace-normal min-w-64">
        <div class="flex items-start gap-2">
          <span class="inline-flex w-5 shrink-0 justify-center pt-0.5">
            @if (download().status === 'finished') {
              <fa-icon [icon]="faCheckCircle" class="text-success" />
            }
            @if (download().status === 'error') {
              <button type="button" class="text-destructive cursor-pointer"
                (click)="toggleError.emit(id())"
                [attr.aria-label]="'Toggle error details for ' + download().title"
                [attr.aria-expanded]="errorExpanded()"
                [attr.data-tooltip]="errorExpanded() ? 'Hide error details' : 'Show error details'">
                <fa-icon [icon]="faTimesCircle" />
              </button>
            }
          </span>
          <span [attr.data-tooltip]="tooltip() || null">
            @if (!!download().filename) {
              <a [href]="link()" target="_blank" class="text-link">{{ download().title }}</a>
            } @else if (download().status === 'error') {
              <button type="button" class="cursor-pointer text-start" (click)="toggleError.emit(id())">
                {{ download().title }}
                @if (!errorExpanded()) {
                  <small class="text-destructive ms-2 whitespace-nowrap">
                    <fa-icon [icon]="faChevronRight" size="xs" class="me-1" />Click for details
                  </small>
                }
              </button>
            } @else {
              <span>{{ download().title }}</span>
            }
          </span>
        </div>
        @if (download().status === 'error' && errorExpanded()) {
          <div hlmAlert variant="destructive" class="bg-destructive/5 border-destructive/40 mt-2 pe-12 text-xs">
            @if (download().msg) {
              <div><strong>Message:</strong> {{ download().msg }}</div>
            }
            @if (download().error) {
              <div><strong>Error:</strong> {{ download().error }}</div>
            }
            <div class="text-muted-foreground break-all"><strong>URL:</strong> {{ download().url }}</div>
            <div hlmAlertAction>
              <button type="button" [attr.class]="copyButton"
                (click)="copyError.emit(id()); $event.stopPropagation()"
                data-tooltip="Copy error details"
                aria-label="Copy error details to clipboard">
                @if (copied()) {
                  <span class="text-success animate-in fade-in-0 zoom-in-95">Copied!</span>
                } @else {
                  <fa-icon [icon]="faCopy" class="animate-in fade-in-0 zoom-in-95" />
                }
              </button>
            </div>
          </div>
        }
      </td>
      <td class="p-2 align-middle whitespace-nowrap">{{ downloadTypeLabel(download(), types()) }}</td>
      <td class="p-2 align-middle whitespace-nowrap">{{ formatQualityLabel(download(), types()) }}</td>
      <td class="p-2 align-middle whitespace-nowrap">{{ formatCodecLabel(download(), types()) }}</td>
      <td class="p-2 align-middle whitespace-nowrap">
        @if (download().size; as size) {
          <span>{{ size | fileSize }}</span>
        }
      </td>
      <td class="p-2 align-middle whitespace-nowrap">
        @if (download().timestamp; as timestamp) {
          <span>{{ timestamp / 1000000 | date:'yyyy-MM-dd HH:mm' }}</span>
        }
      </td>
      <td class="p-2 align-middle whitespace-nowrap">
        <div class="flex justify-end gap-1">
          @if (download().status === 'error') {
            <button type="button" [attr.class]="iconButton" [attr.aria-label]="'Retry download for ' + download().title" data-tooltip="Retry download" (click)="retry.emit(id())"><fa-icon [icon]="faRedoAlt" /></button>
          }
          @if (download().filename) {
            <a [attr.class]="iconButton" [href]="link()" download [attr.aria-label]="'Download result file for ' + download().title" data-tooltip="Download file"><fa-icon [icon]="faDownload" /></a>
          }
          @if (download().filename && canShare()) {
            <button type="button" [attr.class]="iconButton" [attr.aria-label]="'Share result file for ' + download().title" data-tooltip="Share file" (click)="share.emit(id())"><fa-icon [icon]="faShareNodes" /></button>
          }
          <a [attr.class]="iconButton" [href]="download().url" target="_blank" rel="noopener" [attr.aria-label]="'Open source URL for ' + download().title" data-tooltip="Open source page"><fa-icon [icon]="faExternalLinkAlt" /></a>
          <button type="button" [attr.class]="iconButton" [attr.aria-label]="'Delete completed item ' + download().title" data-tooltip="Delete" (click)="remove.emit(id())"><fa-icon [icon]="faTrashAlt" /></button>
        </div>
      </td>
    </tr>
    @for (chapterFile of download().chapter_files ?? []; track chapterFile.filename) {
      <tr class="hover:bg-muted/50 border-b transition-colors" [class.opacity-50]="deleting()" [class.pointer-events-none]="deleting()">
        <td class="p-2 align-middle whitespace-nowrap"></td>
        <td class="p-2 align-middle whitespace-normal">
          <div class="flex items-center gap-2 ps-8">
            <fa-icon [icon]="faCheckCircle" class="text-success" />
            <a [href]="chapterLink(chapterFile.filename)" target="_blank" class="text-link"
              [attr.aria-label]="'Open chapter file ' + chapterFileName(chapterFile.filename)">{{ chapterFileName(chapterFile.filename) }}</a>
          </div>
        </td>
        <td class="p-2 align-middle whitespace-nowrap"></td>
        <td class="p-2 align-middle whitespace-nowrap"></td>
        <td class="p-2 align-middle whitespace-nowrap"></td>
        <td class="p-2 align-middle whitespace-nowrap">
          @if (chapterFile.size) {
            <span>{{ chapterFile.size | fileSize }}</span>
          }
        </td>
        <td class="p-2 align-middle whitespace-nowrap"></td>
        <td class="p-2 align-middle whitespace-nowrap">
          <div class="flex justify-end gap-1">
            <a [attr.class]="iconButton" [href]="chapterLink(chapterFile.filename)" download
              [attr.aria-label]="'Download chapter file ' + chapterFileName(chapterFile.filename)" data-tooltip="Download chapter"><fa-icon [icon]="faDownload" /></a>
          </div>
        </td>
      </tr>
    }
  `,
})
export class DoneEntryComponent {
  readonly id = input.required<string>();
  readonly download = input.required<Download>();
  // The server's download types, for labelling the download's options.
  readonly types = input<DownloadTypeOption[]>([]);
  readonly master = input.required<SelectAllCheckboxComponent>();
  // The server sends the completed list before the configuration on connect,
  // so links have to be rebuilt when the configuration arrives.
  readonly config = input.required<Record<string, unknown>>();
  // Select-all and delete mutate the shared object in place rather than
  // replacing it, so the parent passes these flags separately: a changed
  // input is what tells an OnPush row to re-render.
  readonly checked = input(false);
  readonly deleting = input(false);
  readonly errorExpanded = input(false);
  readonly copied = input(false);
  readonly canShare = input(false);

  readonly retry = output<string>();
  readonly remove = output<string>();
  readonly share = output<string>();
  readonly toggleError = output<string>();
  readonly copyError = output<string>();

  // Library styles applied statically rather than through hlmBtn/hlmTd/hlmTr:
  // across a history of thousands of rows, a directive per cell and button
  // (each with its own class-merging effect) made the first render seconds
  // slower. The classes are the ones those directives produce, and buttons
  // take them as one attribute write rather than a classList.add per token.
  readonly iconButton = buttonVariants({ variant: 'ghost', size: 'icon-sm' });
  readonly copyButton = buttonVariants({ variant: 'outline', size: 'sm' });

  readonly faCheckCircle = faCheckCircle;
  readonly faTimesCircle = faTimesCircle;
  readonly faChevronRight = faChevronRight;
  readonly faCopy = faCopy;
  readonly faRedoAlt = faRedoAlt;
  readonly faDownload = faDownload;
  readonly faShareNodes = faShareNodes;
  readonly faExternalLinkAlt = faExternalLinkAlt;
  readonly faTrashAlt = faTrashAlt;

  readonly downloadTypeLabel = downloadTypeLabel;
  readonly formatQualityLabel = formatQualityLabel;
  readonly formatCodecLabel = formatCodecLabel;
  readonly chapterFileName = chapterFileName;

  link(): string {
    return buildDownloadLink(this.config(), this.download());
  }

  chapterLink(filename: string): string {
    return buildChapterDownloadLink(this.config(), this.download(), filename);
  }

  tooltip(): string {
    return resultItemTooltip(this.download());
  }
}

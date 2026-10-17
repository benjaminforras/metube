import { PercentPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faClock, faDownload, faExternalLinkAlt, faHourglassHalf, faTrashAlt } from '@fortawesome/free-solid-svg-icons';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { buttonVariants } from '@spartan-ng/helm/button';
import { HlmProgressImports } from '@spartan-ng/helm/progress';
import { Download, DownloadTypeOption } from '../interfaces';
import { EtaPipe, SpeedPipe } from '../pipes';
import { formatLabel, isIndeterminate, liveCountdownSeconds } from '../download-display';
import { ItemCheckboxComponent } from './slave-checkbox.component';
import { SelectAllCheckboxComponent } from './master-checkbox.component';

// One row of the Downloading table. OnPush so a progress tick, which replaces
// exactly one queue object, re-renders only that row instead of every row on
// the page. Table rows can't be custom elements (the HTML parser would hoist
// them out of <tbody>), hence the attribute selector.
@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'tr[app-download-row]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PercentPipe,
    FontAwesomeModule,
    HlmBadgeImports,
    HlmProgressImports,
    EtaPipe,
    SpeedPipe,
    ItemCheckboxComponent,
  ],
  template: `
    <td class="p-2 align-middle whitespace-nowrap">
      <app-item-checkbox [id]="id()" [master]="master()" [checkable]="download()" />
    </td>
    <td class="p-2 align-middle whitespace-normal min-w-56" [title]="download().filename ?? ''">
      <div class="flex flex-col items-start gap-x-3 gap-y-2 sm:flex-row sm:items-center">
        <div class="flex flex-wrap items-center gap-2">
          <span>{{ download().title }}</span>
          @if (download().live_status === 'is_live' && download().status !== 'scheduled') {
            <span hlmBadge variant="destructive">LIVE</span>
          }
        </div>
        <!-- The three ways of waiting share the bar's slot, each naming what
             it waits on: a free slot, the user, or the stream. None of them
             draws a bar, whose indeterminate sweep would read as work. -->
        @if (download().status === 'queued') {
          <span [attr.class]="waitSlot">
            <fa-icon [icon]="faHourglassHalf" class="text-[0.625rem]" />
            Queued for a slot
          </span>
        } @else if (download().status === 'pending') {
          <!-- Auto-start off: the slot is the Start button, so it can be
               started where its state is shown, even on a phone where the
               actions column is scrolled out of view. -->
          <button type="button" [attr.class]="startSlot" [attr.aria-label]="'Start download for ' + download().title" (click)="start.emit(id())">
            Auto-start off
            <span aria-hidden="true">·</span>
            <span class="text-foreground inline-flex items-center gap-1">
              <fa-icon [icon]="faDownload" class="text-[0.625rem]" />
              Start
            </span>
          </button>
        } @else if (download().status === 'scheduled') {
          <span [attr.class]="waitSlot" title="Waiting for the stream to start">
            <fa-icon [icon]="faClock" class="text-[0.625rem]" />
            @if (countdownSeconds(); as secs) {
              Live in {{ secs | eta }}
            } @else {
              Waiting for stream
            }
          </span>
        } @else {
          <!-- flex so the bar is the wrapper's only line box; as an inline
               element it sat on a text baseline, and the wrapper grew taller
               than the bar, pulling the centered label below its middle. -->
          <div class="relative flex w-48 shrink-0 sm:ms-auto">
            <hlm-progress class="h-5 rounded-md" [value]="indeterminate() ? null : download().percent">
              <hlm-progress-indicator class="bg-success" />
            </hlm-progress>
            <span class="absolute inset-0 flex items-center justify-center text-xs font-medium">
              @if (download().status === 'postprocessing') {
                Post-processing
              } @else if (!indeterminate() && typeof download().percent === 'number') {
                {{ download().percent / 100 | percent }}
              }
            </span>
          </div>
        }
      </div>
    </td>
    <td class="p-2 align-middle whitespace-nowrap">{{ formatLabel(download(), types()) }}</td>
    <td class="p-2 align-middle whitespace-nowrap">{{ download().speed | speed }}</td>
    <td class="p-2 align-middle whitespace-nowrap">{{ download().eta | eta }}</td>
    <td class="p-2 align-middle whitespace-nowrap">
      <div class="flex justify-end gap-1">
        @if (download().status === 'scheduled') {
          <button type="button" [attr.class]="iconButton" [attr.aria-label]="'Start download for ' + download().title" data-tooltip="Start download" (click)="start.emit(id())"><fa-icon [icon]="faDownload" /></button>
        }
        <button type="button" [attr.class]="iconButton" [attr.aria-label]="'Remove ' + download().title + ' from queue'" data-tooltip="Remove from queue" (click)="remove.emit(id())"><fa-icon [icon]="faTrashAlt" /></button>
        <a [attr.class]="iconButton" [href]="download().url" target="_blank" rel="noopener" [attr.aria-label]="'Open source URL for ' + download().title" data-tooltip="Open source page"><fa-icon [icon]="faExternalLinkAlt" /></a>
      </div>
    </td>
  `,
})
export class DownloadRowComponent {
  readonly id = input.required<string>();
  readonly download = input.required<Download>();
  // The server's download types, for labelling the download's options.
  readonly types = input<DownloadTypeOption[]>([]);
  readonly master = input.required<SelectAllCheckboxComponent>();
  // Select-all and delete mutate the shared object in place rather than
  // replacing it, so the parent passes these flags separately: a changed
  // input is what tells an OnPush row to re-render.
  readonly checked = input(false);
  readonly deleting = input(false);
  // Wall-clock time for the live-stream countdown, ticked by the parent.
  readonly now = input(0);

  readonly start = output<string>();
  readonly remove = output<string>();

  // Library styles applied statically rather than through hlmBtn/hlmTd/hlmTr:
  // across a history of thousands of rows, a directive per cell and button
  // (each with its own class-merging effect) made the first render seconds
  // slower. The classes are the ones those directives produce, and buttons
  // take them as one attribute write rather than a classList.add per token.
  readonly iconButton = buttonVariants({ variant: 'ghost', size: 'icon-sm' });
  // The bar-sized slot a waiting row shows instead of a bar. min-w rather than
  // w so a stream days away still fits its countdown, growing leftwards.
  readonly waitSlot =
    'text-muted-foreground border-muted-foreground/40 flex h-5 min-w-48 shrink-0 items-center justify-center gap-1.5 rounded-md border border-dashed px-2 text-xs font-medium whitespace-nowrap sm:ms-auto';
  readonly startSlot =
    this.waitSlot +
    ' hover:bg-muted hover:border-solid focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:border-solid focus-visible:ring-3 outline-none transition-[color,background-color,border-color,box-shadow,translate] active:translate-y-px';

  readonly faClock = faClock;
  readonly faDownload = faDownload;
  readonly faHourglassHalf = faHourglassHalf;
  readonly faTrashAlt = faTrashAlt;
  readonly faExternalLinkAlt = faExternalLinkAlt;

  readonly formatLabel = formatLabel;

  indeterminate(): boolean {
    return isIndeterminate(this.download());
  }

  countdownSeconds(): number | null {
    return liveCountdownSeconds(this.download(), this.now());
  }
}

import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faCheckCircle, faTimesCircle, faInfoCircle, faXmark } from '@fortawesome/free-solid-svg-icons';
import { HlmAlertImports } from '@spartan-ng/helm/alert';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { ToastService } from '../services/toast.service';

@Component({
  selector: 'app-toast-container',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FontAwesomeModule, HlmAlertImports, HlmButtonImports],
  template: `
<!-- Click-through: the container spans the top corner even when empty. -->
<div class="pointer-events-none fixed end-0 top-0 z-[1100] flex w-full max-w-md flex-col gap-2 p-4" aria-live="polite" aria-atomic="true">
  @for (toast of toasts.toasts(); track toast.id) {
    <!-- Enter classes go through animate.enter so Angular drops them once the
         toast is in, and the exit's animate-out isn't fighting animate-in. -->
    <div hlmAlert role="alert" aria-live="assertive" aria-atomic="true"
      class="pointer-events-auto bg-popover text-popover-foreground grid-cols-[auto_1fr] gap-x-2 pe-9 shadow-lg"
      animate.enter="animate-in fade-in-0 slide-in-from-top-2"
      animate.leave="animate-out fade-out-0 slide-out-to-top-2"
      [class.border-destructive/50]="toast.level === 'error'"
      [class.border-success/50]="toast.level === 'success'">
      <fa-icon
        [icon]="toast.level === 'error' ? faTimesCircle : toast.level === 'success' ? faCheckCircle : faInfoCircle"
        class="row-span-2 mt-0.5"
        [class.text-destructive]="toast.level === 'error'"
        [class.text-success]="toast.level === 'success'"
        [class.text-info]="toast.level === 'info'" />
      <div class="col-start-2 whitespace-pre-line">{{ toast.message }}</div>
      @if (toast.actions) {
        <div class="col-start-2 mt-2 flex flex-wrap justify-end gap-2">
          @for (action of toast.actions; track action.label) {
            <button type="button" hlmBtn size="sm"
              [variant]="action.primary ? 'default' : 'outline'"
              (click)="toasts.respond(toast.id, action.value)">
              {{ action.label }}
            </button>
          }
        </div>
      } @else {
        <button type="button" hlmBtn variant="ghost" size="icon-xs" class="absolute end-2 top-2"
          aria-label="Close" (click)="toasts.dismiss(toast.id)">
          <fa-icon [icon]="faXmark" />
        </button>
      }
    </div>
  }
</div>
`,
})
export class ToastContainerComponent {
  protected readonly toasts = inject(ToastService);
  protected readonly faCheckCircle = faCheckCircle;
  protected readonly faTimesCircle = faTimesCircle;
  protected readonly faInfoCircle = faInfoCircle;
  protected readonly faXmark = faXmark;
}

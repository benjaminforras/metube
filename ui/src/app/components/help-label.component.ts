import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faCircleQuestion } from '@fortawesome/free-regular-svg-icons';
import { HlmPopoverImports } from '@spartan-ng/helm/popover';

// A field label that explains itself. By default clicking the label opens a
// popover with the help text. Given `for`, the text is a real <label> for that
// control, so clicking it focuses or toggles the control as a label should, and
// the help moves to a small (?) button beside it.
@Component({
  selector: 'app-help-label',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HlmPopoverImports, FontAwesomeModule, NgTemplateOutlet],
  template: `
    <ng-template #text><ng-content /></ng-template>
    @if (for(); as target) {
      <span class="inline-flex items-center gap-1.5">
        <label [attr.for]="target" class="cursor-pointer"><ng-container [ngTemplateOutlet]="text" /></label>
        <hlm-popover align="start" sideOffset="6">
          <button type="button" hlmPopoverTrigger
            class="text-muted-foreground hover:text-foreground inline-flex cursor-help rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            aria-label="What this does">
            <fa-icon [icon]="faCircleQuestion" class="text-[0.85em]" />
          </button>
          <hlm-popover-content *hlmPopoverPortal="let ctx">
            <p class="leading-relaxed">{{ help() }}</p>
          </hlm-popover-content>
        </hlm-popover>
      </span>
    } @else {
      <hlm-popover align="start" sideOffset="6">
        <button type="button" hlmPopoverTrigger
          class="cursor-help rounded-sm [letter-spacing:inherit] [text-transform:inherit] outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
          <ng-container [ngTemplateOutlet]="text" />
        </button>
        <hlm-popover-content *hlmPopoverPortal="let ctx">
          <p class="leading-relaxed">{{ help() }}</p>
        </hlm-popover-content>
      </hlm-popover>
    }
  `,
})
export class HelpLabelComponent {
  readonly help = input.required<string>();
  // The id of the control this labels. Leave unset for the click-for-help label.
  readonly for = input<string | null>(null);

  protected readonly faCircleQuestion = faCircleQuestion;
}

import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  DOCUMENT,
  ElementRef,
  NgZone,
  afterNextRender,
  inject,
  viewChild,
} from '@angular/core';

// Tooltips for anything carrying a data-tooltip attribute, from one element
// for the whole page. The download tables can hold thousands of rows with
// several icon buttons each; a tooltip directive per button costs a
// directive, an overlay and listeners per instance, which is what made the
// first render of a long history slow. Here a row only pays for an attribute.
// Styled to match Spartan's hlmTooltip, which the rest of the page uses.
@Component({
  selector: 'app-tooltip-layer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div #tip aria-hidden="true" data-side="top"
      class="bg-foreground text-background pointer-events-none fixed top-0 left-0 z-[1200] w-max max-w-xs scale-95 rounded-md px-3 py-1.5 text-xs text-balance break-words opacity-0 transition-[opacity,scale] duration-100 ease-out data-[state=open]:scale-100 data-[state=open]:opacity-100 motion-reduce:transition-none"
      style="visibility: hidden">
      <span #text></span>
      <span #arrow class="bg-foreground absolute size-2.5 rotate-45 rounded-[2px]"></span>
    </div>
  `,
})
export class TooltipLayerComponent {
  private readonly document = inject(DOCUMENT);
  private readonly tip = viewChild.required<ElementRef<HTMLElement>>('tip');
  private readonly text = viewChild.required<ElementRef<HTMLElement>>('text');
  private readonly arrow = viewChild.required<ElementRef<HTMLElement>>('arrow');

  private target: HTMLElement | null = null;
  private showTimer?: ReturnType<typeof setTimeout>;
  // After a tooltip closes, the next one within this window opens at once, so
  // sweeping along a row of icon buttons doesn't wait on each.
  private warmUntil = 0;
  private scrollFrame = 0;

  private static readonly SHOW_DELAY_MS = 350;
  private static readonly WARM_MS = 400;
  private static readonly GAP_PX = 8;
  private static readonly EDGE_PX = 6;

  constructor() {
    const zone = inject(NgZone);
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      zone.runOutsideAngular(() => {
        const listeners: [string, EventListener, boolean][] = [
          ['pointerover', e => this.onPointerOver(e as PointerEvent), false],
          ['pointerout', e => this.onPointerOut(e as PointerEvent), false],
          ['focusin', e => this.onFocusIn(e), false],
          ['focusout', () => this.hide(), false],
          ['pointerdown', () => this.hide(), true],
          ['scroll', () => this.onScroll(), true],
          ['keydown', e => { if ((e as KeyboardEvent).key === 'Escape') this.hide(); }, false],
        ];
        for (const [type, fn, capture] of listeners) {
          this.document.addEventListener(type, fn, capture);
        }
        destroyRef.onDestroy(() => {
          clearTimeout(this.showTimer);
          cancelAnimationFrame(this.scrollFrame);
          for (const [type, fn, capture] of listeners) {
            this.document.removeEventListener(type, fn, capture);
          }
        });
      });
    });
  }

  private findTarget(node: EventTarget | null): HTMLElement | null {
    return node instanceof Element ? node.closest<HTMLElement>('[data-tooltip]') : null;
  }

  private onPointerOver(event: PointerEvent) {
    // Touch has no hover; a tap would flash the tooltip and then leave it up.
    if (event.pointerType !== 'mouse') return;
    const target = this.findTarget(event.target);
    if (target && target !== this.target) {
      this.schedule(target);
    }
  }

  private onPointerOut(event: PointerEvent) {
    const leaving = this.findTarget(event.target);
    const entering = this.findTarget(event.relatedTarget);
    if (leaving && leaving !== entering) {
      this.hide();
    }
  }

  private onFocusIn(event: Event) {
    const target = this.findTarget(event.target);
    // Keyboard focus only: a mouse click already had its hover tooltip.
    if (target && target.matches(':focus-visible')) {
      this.show(target);
    }
  }

  // Scrolling moves the anchor, not the fixed tooltip: follow it, and let go
  // once it leaves the viewport. Focusing a button can itself scroll the page.
  private onScroll() {
    const target = this.target;
    if (!target || this.tip().nativeElement.dataset['state'] !== 'open' || this.scrollFrame) {
      return;
    }
    this.scrollFrame = requestAnimationFrame(() => {
      this.scrollFrame = 0;
      const rect = target.getBoundingClientRect();
      const inView = rect.bottom > 0 && rect.top < this.document.documentElement.clientHeight;
      if (this.target === target && inView) {
        this.show(target);
      } else if (this.target === target) {
        this.hide();
      }
    });
  }

  private schedule(target: HTMLElement) {
    clearTimeout(this.showTimer);
    if (Date.now() < this.warmUntil) {
      this.show(target);
      return;
    }
    this.target = target;
    this.showTimer = setTimeout(() => this.show(target), TooltipLayerComponent.SHOW_DELAY_MS);
  }

  private show(target: HTMLElement) {
    clearTimeout(this.showTimer);
    const label = target.dataset['tooltip'];
    if (!label || !target.isConnected) {
      this.hide();
      return;
    }
    this.target = target;
    const tip = this.tip().nativeElement;
    this.text().nativeElement.textContent = label;
    tip.style.visibility = 'visible';

    const anchor = target.getBoundingClientRect();
    // Layout size, not the rect: the enter animation scales the tooltip.
    const box = { width: tip.offsetWidth, height: tip.offsetHeight };
    const { GAP_PX, EDGE_PX } = TooltipLayerComponent;
    const viewportWidth = this.document.documentElement.clientWidth;
    const above = anchor.top - box.height - GAP_PX >= EDGE_PX;
    const top = above ? anchor.top - box.height - GAP_PX : anchor.bottom + GAP_PX;
    const centre = anchor.left + anchor.width / 2;
    const left = Math.min(Math.max(centre - box.width / 2, EDGE_PX), viewportWidth - box.width - EDGE_PX);
    tip.style.translate = `${Math.round(left)}px ${Math.round(top)}px`;
    tip.style.transformOrigin = above ? 'bottom center' : 'top center';

    const arrow = this.arrow().nativeElement;
    arrow.style.left = `${Math.round(centre - left - 5)}px`;
    arrow.style.top = above ? '' : '-4px';
    arrow.style.bottom = above ? '-4px' : '';
    tip.dataset['state'] = 'open';
  }

  private hide() {
    clearTimeout(this.showTimer);
    if (this.target && this.tip().nativeElement.dataset['state'] === 'open') {
      this.warmUntil = Date.now() + TooltipLayerComponent.WARM_MS;
    }
    this.target = null;
    const tip = this.tip().nativeElement;
    delete tip.dataset['state'];
    tip.style.visibility = 'hidden';
  }
}

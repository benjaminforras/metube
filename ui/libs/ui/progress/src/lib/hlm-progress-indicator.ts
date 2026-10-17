import { Directionality } from '@angular/cdk/bidi';
import { Directive, computed, inject } from '@angular/core';
import { BrnProgressIndicator, injectBrnProgress } from '@spartan-ng/brain/progress';
import { classes } from '@spartan-ng/helm/utils';

@Directive({
	selector: '[hlmProgressIndicator],hlm-progress-indicator',
	hostDirectives: [BrnProgressIndicator],
	host: {
		'data-slot': 'progress-indicator',
		'[class.animate-indeterminate]': '_indeterminate()',
		'[style.transform]': '_transform()',
	},
})
export class HlmProgressIndicator {
	private readonly _progress = injectBrnProgress();
	private readonly _dir = inject(Directionality);
	// Offset the indicator by the unfilled remainder. In RTL the bar fills from the inline-start
	// (visually the right), so translate the opposite way to keep the fill on the correct side.
	protected readonly _transform = computed(() => {
		const offset = 100 - (this._progress.value() ?? 100);
		return `translateX(${this._dir.valueSignal() === 'rtl' ? '' : '-'}${offset}%)`;
	});
	protected readonly _indeterminate = computed(
		() => this._progress.value() === null || this._progress.value() === undefined,
	);

	constructor() {
		// Progress arrives about twice a second. A linear glide lasting about as long as
		// the gap between updates keeps the bar moving steadily; a short eased transition
		// makes it lurch forward and then sit still until the next update.
		classes(() => 'bg-primary h-full w-full flex-1 transition-transform duration-500 ease-linear');
	}
}

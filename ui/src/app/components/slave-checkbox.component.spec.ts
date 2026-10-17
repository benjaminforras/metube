import { TestBed } from '@angular/core/testing';
import { SelectAllCheckboxComponent } from './master-checkbox.component';
import { ItemCheckboxComponent } from './slave-checkbox.component';

describe('ItemCheckboxComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ItemCheckboxComponent, SelectAllCheckboxComponent],
    }).compileComponents();
  });

  it('creates with master and checkable inputs', () => {
    const masterFixture = TestBed.createComponent(SelectAllCheckboxComponent);
    masterFixture.componentRef.setInput('id', 'q');
    masterFixture.componentRef.setInput('list', new Map());
    masterFixture.detectChanges();

    const itemFixture = TestBed.createComponent(ItemCheckboxComponent);
    itemFixture.componentRef.setInput('id', 'row1');
    itemFixture.componentRef.setInput('master', masterFixture.componentInstance);
    itemFixture.componentRef.setInput('checkable', { checked: false });
    itemFixture.detectChanges();
    expect(itemFixture.componentInstance).toBeTruthy();
  });

  it('reports the shift modifier from the click to the master', () => {
    const masterFixture = TestBed.createComponent(SelectAllCheckboxComponent);
    masterFixture.componentRef.setInput('id', 'q');
    masterFixture.componentRef.setInput('list', new Map());
    masterFixture.detectChanges();
    const master = masterFixture.componentInstance;
    const reported: [string | undefined, boolean | undefined][] = [];
    master.selectionChanged = (id?: string, extend?: boolean) => {
      reported.push([id, extend]);
    };

    const itemFixture = TestBed.createComponent(ItemCheckboxComponent);
    itemFixture.componentRef.setInput('id', 'row1');
    itemFixture.componentRef.setInput('master', master);
    itemFixture.componentRef.setInput('checkable', { checked: false });
    itemFixture.detectChanges();
    const item = itemFixture.componentInstance;

    item.clicked(new MouseEvent('click', { shiftKey: true }));
    item.changed();
    // The modifier must not stick to the next toggle.
    item.changed();

    expect(reported).toEqual([
      ['row1', true],
      ['row1', false],
    ]);
  });

  // Drives the rendered control: click must reach the component before change.
  it('reads shift from a real shift-click on the rendered checkbox', async () => {
    const masterFixture = TestBed.createComponent(SelectAllCheckboxComponent);
    masterFixture.componentRef.setInput('id', 'q');
    masterFixture.componentRef.setInput('list', new Map());
    masterFixture.detectChanges();
    const master = masterFixture.componentInstance;
    const reported: [string | undefined, boolean | undefined][] = [];
    master.selectionChanged = (id?: string, extend?: boolean) => {
      reported.push([id, extend]);
    };

    const itemFixture = TestBed.createComponent(ItemCheckboxComponent);
    itemFixture.componentRef.setInput('id', 'row1');
    itemFixture.componentRef.setInput('master', master);
    const checkable = { checked: false };
    itemFixture.componentRef.setInput('checkable', checkable);
    itemFixture.detectChanges();
    // ngModel writes its initial value asynchronously; let it land first.
    await itemFixture.whenStable();

    const control = (itemFixture.nativeElement as HTMLElement).querySelector('input[type="checkbox"]') as HTMLInputElement;
    control.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, shiftKey: true }));
    itemFixture.detectChanges();

    expect(checkable.checked).toBe(true);
    expect(reported).toEqual([['row1', true]]);
  });
});

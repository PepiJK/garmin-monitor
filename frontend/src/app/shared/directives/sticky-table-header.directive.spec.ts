import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StickyTableHeaderDirective } from './sticky-table-header.directive';

@Component({
  imports: [StickyTableHeaderDirective],
  template: `
    <div class="relative overflow-auto" data-testid="test-container">
      <table data-testid="test-table">
        <thead appStickyHeader data-testid="test-thead">
          <tr>
            <th>Col</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Row</td>
          </tr>
        </tbody>
      </table>
    </div>
  `,
})
class HostTestComponent {}

describe('StickyTableHeaderDirective', () => {
  it('sizes the scroll container to remaining viewport height or sensible min height on resize', async () => {
    await TestBed.configureTestingModule({
      imports: [HostTestComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(HostTestComponent);
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    const container = el.querySelector('[data-testid="test-container"]') as HTMLDivElement;

    Object.defineProperty(window, 'innerHeight', {
      value: 952,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true, writable: true });

    let mockContainerTop = 309;
    vi.spyOn(container, 'getBoundingClientRect').mockImplementation(
      () =>
        ({
          top: mockContainerTop,
          bottom: mockContainerTop + 500,
          height: 500,
          left: 0,
          right: 800,
          width: 800,
          x: 0,
          y: mockContainerTop,
          toJSON: () => ({}),
        }) as DOMRect,
    );

    window.dispatchEvent(new Event('resize'));
    // 952 - 309 - 28 = 615px (takes remaining viewport height)
    expect(container.style.maxHeight).toBe('615px');

    // When table starts far down the page (e.g. below charts at y = 875), falls back to sensible min height (60% of 952 = 571px >= 420px)
    mockContainerTop = 875;
    window.dispatchEvent(new Event('resize'));
    expect(container.style.maxHeight).toBe('571px');
  });
});

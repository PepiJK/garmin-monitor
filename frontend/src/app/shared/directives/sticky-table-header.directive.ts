import { AfterViewInit, Directive, ElementRef, NgZone, OnDestroy, inject } from '@angular/core';

@Directive({
  selector: 'thead[appStickyHeader]',
})
export class StickyTableHeaderDirective implements AfterViewInit, OnDestroy {
  private readonly el = inject<ElementRef<HTMLTableSectionElement>>(ElementRef);
  private readonly ngZone = inject(NgZone);
  private resizeObserver: ResizeObserver | null = null;

  private readonly onResize = (): void => {
    this.updateContainerMaxHeight();
  };

  ngAfterViewInit(): void {
    this.ngZone.runOutsideAngular(() => {
      window.addEventListener('resize', this.onResize, { passive: true });

      const scrollContainer = this.getScrollContainer();
      if (scrollContainer && typeof ResizeObserver !== 'undefined') {
        this.resizeObserver = new ResizeObserver(() => {
          this.updateContainerMaxHeight();
        });
        this.resizeObserver.observe(document.body);
      }

      this.updateContainerMaxHeight();
    });
  }

  ngOnDestroy(): void {
    window.removeEventListener('resize', this.onResize);
    this.resizeObserver?.disconnect();
  }

  private getScrollContainer(): HTMLElement | null {
    return this.el.nativeElement.closest('div.overflow-auto, div.overflow-x-auto');
  }

  updateContainerMaxHeight(): void {
    const scrollContainer = this.getScrollContainer();
    if (!scrollContainer || typeof scrollContainer.getBoundingClientRect !== 'function') {
      return;
    }

    const vh = window.innerHeight || 900;
    const containerTop = scrollContainer.getBoundingClientRect().top + window.scrollY;
    const bottomPadding = 28;
    const remainingViewportHeight = Math.floor(vh - containerTop - bottomPadding);
    const maxHeightPx =
      remainingViewportHeight >= 360
        ? remainingViewportHeight
        : Math.max(420, Math.floor(vh * 0.6));

    scrollContainer.style.maxHeight = `${maxHeightPx}px`;
  }
}

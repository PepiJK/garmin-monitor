import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AppComponent } from './app.component';
import { routes } from './app.routes';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter(routes)],
    }).compileComponents();
  });

  it('should create the app and render navigation links', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    await fixture.whenStable();
    const app = fixture.componentInstance;
    expect(app.title()).toBe('Garmin Monitor');

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Garmin Monitor');
    expect(compiled.textContent).toContain('Training');
    expect(compiled.textContent).toContain('Health');
  });

  it('should redirect root path to /training and navigate to /health', async () => {
    const harness = await RouterTestingHarness.create();
    const router = TestBed.inject(Router);

    await harness.navigateByUrl('/');
    expect(router.url).toBe('/training');
    expect(harness.routeNativeElement?.textContent).toContain('Training');

    await harness.navigateByUrl('/health');
    expect(router.url).toBe('/health');
    expect(harness.routeNativeElement?.textContent).toContain('Health');
  });
});

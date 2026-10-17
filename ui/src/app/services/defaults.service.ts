import { inject, Injectable, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, catchError, tap, throwError } from 'rxjs';
import { MeTubeSocket } from './metube-socket.service';
import { FormDefaults } from '../interfaces';

// The server-side form defaults. The server sends them on connect and after
// every save, so all open pages (and devices) see the same values.
@Injectable({
  providedIn: 'root',
})
export class DefaultsService {
  private http = inject(HttpClient);
  private socket = inject(MeTubeSocket);

  // null until the server has sent them.
  readonly defaults = signal<FormDefaults | null>(null);

  constructor() {
    this.socket.fromEvent('defaults')
      .pipe(takeUntilDestroyed())
      .subscribe((strdata: string) => {
        this.defaults.set(JSON.parse(strdata) as FormDefaults);
      });
  }

  save(values: FormDefaults): Observable<FormDefaults> {
    return this.http.post<FormDefaults>('defaults', values).pipe(
      tap((saved) => this.defaults.set(saved)),
      catchError(this.explain),
    );
  }

  reset(): Observable<FormDefaults> {
    return this.http.post<FormDefaults>('defaults/reset', {}).pipe(
      tap((saved) => this.defaults.set(saved)),
      catchError(this.explain),
    );
  }

  // The server names the offending field in the response's status text.
  private explain(error: HttpErrorResponse) {
    const msg = typeof error.error === 'string' && error.error
      ? error.error.replace(/^\d{3}: /, '')
      : (error.statusText || error.message || 'Request failed');
    return throwError(() => new Error(msg));
  }
}

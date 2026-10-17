import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Subject } from 'rxjs';
import { DefaultsService } from './defaults.service';
import { MeTubeSocket } from './metube-socket.service';

describe('DefaultsService', () => {
  let events: Subject<string>;
  let service: DefaultsService;
  let http: HttpTestingController;

  beforeEach(() => {
    events = new Subject<string>();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MeTubeSocket, useValue: { fromEvent: () => events } },
      ],
    });
    service = TestBed.inject(DefaultsService);
    http = TestBed.inject(HttpTestingController);
  });

  it('takes the defaults the server broadcasts', () => {
    expect(service.defaults()).toBeNull();
    events.next(JSON.stringify({ download_type: 'audio' }));
    expect(service.defaults()?.download_type).toBe('audio');
  });

  it('reports the field the server rejected', () => {
    let message = '';
    service.save({} as never).subscribe({ error: (e: Error) => (message = e.message) });

    http.expectOne('defaults').flush('400: auto_start must be true or false', {
      status: 400,
      statusText: 'auto_start must be true or false',
    });

    expect(message).toBe('auto_start must be true or false');
  });
});

import { Injectable, inject } from '@angular/core';
import { ApplicationRef } from '@angular/core';
import { Socket } from 'ngx-socket-io';
import { appBasePath } from '../base-path';

@Injectable(
  { providedIn: 'root' }
)
export class MeTubeSocket extends Socket {

  constructor() {
    const appRef = inject(ApplicationRef);

    const path = appBasePath() + 'socket.io';
    super({ url: '', options: { path } }, appRef);
  }
}

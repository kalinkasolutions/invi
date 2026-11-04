import { Injectable } from '@angular/core';

interface RuntimeConfig {
  invidiousUrl: string;
}

/** Settings the container hands over at runtime through /config.json. */
@Injectable({ providedIn: 'root' })
export class AppConfig {
  invidiousUrl = '';

  async load(): Promise<void> {
    const response = await fetch('/config.json');
    const config: RuntimeConfig = await response.json();
    this.invidiousUrl = config.invidiousUrl.replace(/\/+$/, '');
  }
}

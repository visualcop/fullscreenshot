import * as Nightmare from "nightmare";
import { ISize, IWindowSizes } from "./types";
import { debugMsg } from "./debug";
import * as gm from "gm";
import { promisify } from "util";

export interface IProviderInfo {
  scrollbarWidth: number;
  windowSizes: IWindowSizes;
  pixelDensity: number;
  userAgent: string;
}

export class NightmareProvider {
  private constructor(public readonly nightmare: Nightmare, public readonly info: IProviderInfo) {
    debugMsg(`Detected provider info: `, this.info);
  }

  public static async create(nightmare: Nightmare): Promise<NightmareProvider> {
    const scrollbarWidth = await getScrollbarWidth(nightmare);
    const windowSizes = await getWindowSizes(nightmare);
    const pixelDensity = await getPixelDensity(nightmare);
    const userAgent = await getUserAgent(nightmare);

    return new NightmareProvider(nightmare, {
      scrollbarWidth,
      windowSizes,
      pixelDensity,
      userAgent,
    });
  }

  public async execute<T>(func: (...args: any[]) => T): Promise<T> {
    return (this.nightmare.evaluate(func) as any) as Promise<T>;
  }

  public async resizeWidth(width: number): Promise<void> {
    await this.nightmare.viewport(width + this.info.scrollbarWidth, this.info.windowSizes.outer.height);
    await this.nightmare.wait(100);
  }

  public async screenshot(path: string): Promise<void> {
    await this.nightmare.screenshot(path);
  }

  public async getRealHeight(): Promise<number> {
    return this.execute(() => document.body.scrollHeight);
  }

  public async scrollTo(height: number): Promise<number> {
    const realScrollPosition = await this.nightmare.evaluate(
      ((height: number) => {
        window.scrollTo(0, height);
        return window.scrollY;
      }) as any,
      height as any
    );

    // wait for scrollbar to disappear only on mac os x
    if (this.info.scrollbarWidth === 0 && this.info.userAgent.toLowerCase().includes("mac")) {
      await this.nightmare.wait(800);
    }

    return realScrollPosition as any;
  }
}

async function getScrollbarWidth(nightmare: Nightmare): Promise<number> {
  const width = await nightmare.evaluate(() => {
    var outer = document.createElement("div");
    outer.style.visibility = "hidden";
    outer.style.width = "100px";
    outer.style.msOverflowStyle = "scrollbar";

    document.body.appendChild(outer);

    var widthNoScroll = outer.offsetWidth;
    // force scrollbars
    outer.style.overflow = "scroll";

    var inner = document.createElement("div");
    inner.style.width = "100%";
    outer.appendChild(inner);

    var widthWithScroll = inner.offsetWidth;

    outer.parentNode!.removeChild(outer);

    return widthNoScroll - widthWithScroll;
  });

  return width as any;
}

async function getWindowSizes(nightmare: Nightmare): Promise<IWindowSizes> {
  return nightmare.evaluate(() => ({
    outer: {
      width: window.outerWidth,
      height: window.outerHeight,
    },
    inner: {
      width: window.innerWidth,
      height: window.innerHeight,
    },
  })) as any;
}

async function getPixelDensity(nightmare: Nightmare): Promise<number> {
  return nightmare.evaluate(() => window.devicePixelRatio) as any;
}

async function getUserAgent(nightmare: Nightmare): Promise<string> {
  return nightmare.evaluate(() => window.navigator.userAgent) as any;
}
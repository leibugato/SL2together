declare const wx: any;
declare const App: any;
declare const Page: any;
declare const Component: any;
declare const getApp: () => any;
declare const getCurrentPages: () => any[];

declare namespace WechatMiniprogram {
  interface TouchEvent {
    currentTarget: {
      dataset: Record<string, string | number | boolean>;
    };
    detail: Record<string, unknown>;
  }

  interface Input {
    detail: {
      value: string;
    };
    currentTarget: {
      dataset: Record<string, string | number | boolean>;
    };
  }

  interface PickerChange {
    detail: {
      value: string | number;
    };
  }

  interface ShowModalSuccessCallbackResult {
    confirm: boolean;
    cancel: boolean;
  }
}

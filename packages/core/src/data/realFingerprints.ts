/**
 * Real-device fingerprint samples, generated from the Apify / BrowserForge
 * Bayesian network of observed browser traffic (Apache-2.0).
 *
 * DO NOT EDIT BY HAND. Regenerate with scripts/generate-fingerprint-data.py.
 * Every sample is a single coherent device: UA, Client Hints, GPU, screen,
 * fonts, CPU and memory all come from the same distribution draw.
 *
 * Upstream: https://github.com/daijro/browserforge
 *           https://github.com/apify/fingerprint-suite
 */

export interface RealFingerprint {
  id: string;
  label: string;
  os: 'Windows' | 'macOS' | 'Android' | 'Linux';
  browser: 'Chrome' | 'Edge';
  mobile: boolean;
  userAgent: string;
  platform: string;
  oscpu: string;
  vendor: string;
  chromeMajor: number;
  brands: Array<{ brand: string; version: string }>;
  secChUa: string;
  secChUaPlatform: string;
  secChUaMobile: string;
  acceptLanguage: string;
  screen: { width: number; height: number; dpr: number };
  cores: number;
  memoryGb: number;
  touchPoints: number;
  gpu: { vendor: string; renderer: string };
  fonts: string[];
  locale: string;
  languages: string[];
  dnt: string | null;
}

export const REAL_FINGERPRINTS: RealFingerprint[] = [
  {
    "id": "real-01",
    "label": "Windows 11 · Intel",
    "os": "Windows",
    "browser": "Chrome",
    "mobile": false,
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36",
    "platform": "Win32",
    "oscpu": "",
    "vendor": "Google Inc.",
    "chromeMajor": 157,
    "brands": [
      {
        "brand": "Not-A.Brand",
        "version": "99"
      },
      {
        "brand": "Google Chrome",
        "version": "157"
      },
      {
        "brand": "Chromium",
        "version": "157"
      }
    ],
    "secChUa": "\"Not-A.Brand\";v=\"99\", \"Google Chrome\";v=\"157\", \"Chromium\";v=\"157\"",
    "secChUaPlatform": "Windows",
    "secChUaMobile": "?0",
    "acceptLanguage": "en-US;q=1.0",
    "screen": {
      "width": 1500,
      "height": 1000,
      "dpr": 2.0
    },
    "cores": 12,
    "memoryGb": 8,
    "touchPoints": 0,
    "gpu": {
      "vendor": "Google Inc. (NVIDIA)",
      "renderer": "ANGLE (NVIDIA, NVIDIA T400 4GB (0x00001FF2) Direct3D11 vs_5_0 ps_5_0, D3D11)"
    },
    "fonts": [
      "Agency FB",
      "Calibri",
      "Century",
      "Century Gothic",
      "Franklin Gothic",
      "Haettenschweiler",
      "Leelawadee",
      "Lucida Bright",
      "Lucida Sans",
      "MS Outlook",
      "MS Reference Specialty",
      "MS UI Gothic",
      "MT Extra",
      "Marlett",
      "Microsoft Uighur",
      "Monotype Corsiva",
      "Pristina",
      "Segoe UI Light"
    ],
    "locale": "en-US",
    "languages": [
      "en-US"
    ],
    "dnt": ""
  },
  {
    "id": "real-02",
    "label": "Windows 11 · Intel",
    "os": "Windows",
    "browser": "Chrome",
    "mobile": false,
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36",
    "platform": "Win32",
    "oscpu": "",
    "vendor": "Google Inc.",
    "chromeMajor": 156,
    "brands": [
      {
        "brand": "Not:A-Brand",
        "version": "8"
      },
      {
        "brand": "Chromium",
        "version": "156"
      },
      {
        "brand": "Google Chrome",
        "version": "156"
      }
    ],
    "secChUa": "\"Not:A-Brand\";v=\"8\", \"Chromium\";v=\"156\", \"Google Chrome\";v=\"156\"",
    "secChUaPlatform": "Windows",
    "secChUaMobile": "?0",
    "acceptLanguage": "en-US;q=1.0",
    "screen": {
      "width": 1920,
      "height": 1080,
      "dpr": 1.0
    },
    "cores": 12,
    "memoryGb": 32,
    "touchPoints": 0,
    "gpu": {
      "vendor": "Google Inc. (Intel)",
      "renderer": "ANGLE (Intel, Intel(R) HD Graphics 630 (0x0000591B) Direct3D11 vs_5_0 ps_5_0, D3D11)"
    },
    "fonts": [
      "Calibri",
      "Franklin Gothic",
      "MS UI Gothic",
      "Marlett",
      "Segoe UI Light"
    ],
    "locale": "en-US",
    "languages": [
      "en-US"
    ],
    "dnt": ""
  },
  {
    "id": "real-03",
    "label": "Windows 11 · Intel",
    "os": "Windows",
    "browser": "Chrome",
    "mobile": false,
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36",
    "platform": "Win32",
    "oscpu": "",
    "vendor": "Google Inc.",
    "chromeMajor": 151,
    "brands": [
      {
        "brand": "Not=A?Brand",
        "version": "99"
      },
      {
        "brand": "Google Chrome",
        "version": "151"
      },
      {
        "brand": "Chromium",
        "version": "151"
      }
    ],
    "secChUa": "\"Not=A?Brand\";v=\"99\", \"Google Chrome\";v=\"151\", \"Chromium\";v=\"151\"",
    "secChUaPlatform": "Windows",
    "secChUaMobile": "?0",
    "acceptLanguage": "en-US;q=1.0",
    "screen": {
      "width": 1920,
      "height": 1080,
      "dpr": 1.0
    },
    "cores": 8,
    "memoryGb": 8,
    "touchPoints": 0,
    "gpu": {
      "vendor": "Google Inc. (Intel)",
      "renderer": "ANGLE (Intel, Intel(R) UHD Graphics (0x00009B41) Direct3D11 vs_5_0 ps_5_0, D3D11)"
    },
    "fonts": [
      "Agency FB",
      "Calibri",
      "Century",
      "Century Gothic",
      "Franklin Gothic",
      "Haettenschweiler",
      "Leelawadee",
      "Lucida Bright",
      "Lucida Sans",
      "MS Outlook",
      "MS Reference Specialty",
      "MS UI Gothic",
      "MT Extra",
      "Marlett",
      "Microsoft Uighur",
      "Monotype Corsiva",
      "Pristina",
      "Segoe UI Light"
    ],
    "locale": "en-US",
    "languages": [
      "en-US"
    ],
    "dnt": ""
  },
  {
    "id": "real-04",
    "label": "Windows 11 · Intel",
    "os": "Windows",
    "browser": "Chrome",
    "mobile": false,
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36",
    "platform": "Win32",
    "oscpu": "",
    "vendor": "Google Inc.",
    "chromeMajor": 155,
    "brands": [
      {
        "brand": "Google Chrome",
        "version": "155"
      },
      {
        "brand": "Chromium",
        "version": "155"
      },
      {
        "brand": "Not(A:Brand",
        "version": "24"
      }
    ],
    "secChUa": "\"Google Chrome\";v=\"155\", \"Chromium\";v=\"155\", \"Not(A:Brand\";v=\"24\"",
    "secChUaPlatform": "Windows",
    "secChUaMobile": "?0",
    "acceptLanguage": "en-US;q=1.0",
    "screen": {
      "width": 1920,
      "height": 1080,
      "dpr": 1.0
    },
    "cores": 12,
    "memoryGb": 16,
    "touchPoints": 0,
    "gpu": {
      "vendor": "Google Inc. (NVIDIA)",
      "renderer": "ANGLE (NVIDIA, NVIDIA GeForce GTX 1060 6GB (0x00001C03) Direct3D11 vs_5_0 ps_5_0, D3D11)"
    },
    "fonts": [
      "Agency FB",
      "Calibri",
      "Century",
      "Century Gothic",
      "Franklin Gothic",
      "Haettenschweiler",
      "Leelawadee",
      "Lucida Bright",
      "Lucida Sans",
      "MS Outlook",
      "MS Reference Specialty",
      "MS UI Gothic",
      "MT Extra",
      "Marlett",
      "Microsoft Uighur",
      "Monotype Corsiva",
      "Pristina",
      "Segoe UI Light"
    ],
    "locale": "en-US",
    "languages": [
      "en-US"
    ],
    "dnt": ""
  },
  {
    "id": "real-05",
    "label": "Windows 11 · Intel",
    "os": "Windows",
    "browser": "Chrome",
    "mobile": false,
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
    "platform": "Win32",
    "oscpu": "",
    "vendor": "Google Inc.",
    "chromeMajor": 132,
    "brands": [
      {
        "brand": "Not A(Brand",
        "version": "8"
      },
      {
        "brand": "Chromium",
        "version": "132"
      },
      {
        "brand": "Google Chrome",
        "version": "132"
      }
    ],
    "secChUa": "\"Not A(Brand\";v=\"8\", \"Chromium\";v=\"132\", \"Google Chrome\";v=\"132\"",
    "secChUaPlatform": "Windows",
    "secChUaMobile": "?0",
    "acceptLanguage": "en-US;q=1.0",
    "screen": {
      "width": 1707,
      "height": 1067,
      "dpr": 1.5
    },
    "cores": 20,
    "memoryGb": 8,
    "touchPoints": 0,
    "gpu": {
      "vendor": "Google Inc. (NVIDIA)",
      "renderer": "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Laptop GPU (0x00002560) Direct3D11 vs_5_0 ps_5_0, D3D11)"
    },
    "fonts": [
      "Calibri",
      "Franklin Gothic",
      "MS UI Gothic",
      "MT Extra",
      "Marlett",
      "Segoe UI Light",
      "SimHei"
    ],
    "locale": "en-US",
    "languages": [
      "en-US"
    ],
    "dnt": ""
  },
  {
    "id": "real-06",
    "label": "Windows 11 · Intel",
    "os": "Windows",
    "browser": "Chrome",
    "mobile": false,
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36",
    "platform": "Win32",
    "oscpu": "",
    "vendor": "Google Inc.",
    "chromeMajor": 154,
    "brands": [
      {
        "brand": "Not A(Brand",
        "version": "99"
      },
      {
        "brand": "Chromium",
        "version": "154"
      }
    ],
    "secChUa": "\"Not A(Brand\";v=\"99\", \"Chromium\";v=\"154\"",
    "secChUaPlatform": "Windows",
    "secChUaMobile": "?0",
    "acceptLanguage": "en-US;q=1.0",
    "screen": {
      "width": 1536,
      "height": 864,
      "dpr": 1.25
    },
    "cores": 8,
    "memoryGb": 4,
    "touchPoints": 0,
    "gpu": {
      "vendor": "Google Inc. (Intel)",
      "renderer": "ANGLE (Intel, Intel(R) Graphics (0x00007D67) Direct3D11 vs_5_0 ps_5_0, D3D11)"
    },
    "fonts": [
      "Agency FB",
      "Arial Unicode MS",
      "Calibri",
      "Century",
      "Century Gothic",
      "Franklin Gothic",
      "Haettenschweiler",
      "Lucida Bright",
      "Lucida Sans",
      "MS Mincho",
      "MS Outlook",
      "MS Reference Specialty",
      "MS UI Gothic",
      "MT Extra",
      "Marlett",
      "Monotype Corsiva",
      "Pristina",
      "Segoe UI Light"
    ],
    "locale": "en-US",
    "languages": [
      "en-US"
    ],
    "dnt": ""
  },
  {
    "id": "real-07",
    "label": "Windows 11 · NVIDIA",
    "os": "Windows",
    "browser": "Chrome",
    "mobile": false,
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
    "platform": "Win32",
    "oscpu": "",
    "vendor": "Google Inc.",
    "chromeMajor": 138,
    "brands": [
      {
        "brand": "Not)A;Brand",
        "version": "8"
      },
      {
        "brand": "Chromium",
        "version": "138"
      },
      {
        "brand": "Google Chrome",
        "version": "138"
      }
    ],
    "secChUa": "\"Not)A;Brand\";v=\"8\", \"Chromium\";v=\"138\", \"Google Chrome\";v=\"138\"",
    "secChUaPlatform": "Windows",
    "secChUaMobile": "?0",
    "acceptLanguage": "de-DE;q=1.0",
    "screen": {
      "width": 2560,
      "height": 1440,
      "dpr": 1.6500000953674316
    },
    "cores": 16,
    "memoryGb": 8,
    "touchPoints": 0,
    "gpu": {
      "vendor": "Google Inc. (Intel)",
      "renderer": "ANGLE (Intel, Intel(R) HD Graphics Family (0x00000A16) Direct3D11 vs_5_0 ps_5_0, D3D11)"
    },
    "fonts": [
      "Agency FB",
      "Calibri",
      "Century",
      "Century Gothic",
      "Franklin Gothic",
      "Futura Bk BT",
      "Futura Md BT",
      "GOTHAM",
      "Haettenschweiler",
      "Humanst521 BT",
      "Lucida Bright",
      "Lucida Sans",
      "MS Outlook",
      "MS Reference Specialty",
      "MS UI Gothic",
      "MT Extra",
      "Marlett",
      "Monotype Corsiva",
      "Pristina",
      "Segoe UI Light"
    ],
    "locale": "de-DE",
    "languages": [
      "de-DE"
    ],
    "dnt": ""
  },
  {
    "id": "real-08",
    "label": "Windows 11 · NVIDIA",
    "os": "Windows",
    "browser": "Chrome",
    "mobile": false,
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
    "platform": "Win32",
    "oscpu": "",
    "vendor": "Google Inc.",
    "chromeMajor": 139,
    "brands": [
      {
        "brand": "Not;A=Brand",
        "version": "99"
      },
      {
        "brand": "Google Chrome",
        "version": "139"
      },
      {
        "brand": "Chromium",
        "version": "139"
      }
    ],
    "secChUa": "\"Not;A=Brand\";v=\"99\", \"Google Chrome\";v=\"139\", \"Chromium\";v=\"139\"",
    "secChUaPlatform": "Windows",
    "secChUaMobile": "?0",
    "acceptLanguage": "de-DE;q=1.0",
    "screen": {
      "width": 1536,
      "height": 864,
      "dpr": 1.25
    },
    "cores": 4,
    "memoryGb": 8,
    "touchPoints": 0,
    "gpu": {
      "vendor": "Google Inc. (Intel)",
      "renderer": "ANGLE (Intel, Intel(R) HD Graphics 520 (0x00001921) Direct3D11 vs_5_0 ps_5_0, D3D11-27.20.100.8854)"
    },
    "fonts": [
      "Calibri",
      "Franklin Gothic",
      "MS UI Gothic",
      "Marlett",
      "Segoe UI Light"
    ],
    "locale": "de-DE",
    "languages": [
      "de-DE"
    ],
    "dnt": ""
  },
  {
    "id": "real-09",
    "label": "Windows 11 · NVIDIA",
    "os": "Windows",
    "browser": "Chrome",
    "mobile": false,
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36",
    "platform": "Win32",
    "oscpu": "",
    "vendor": "Google Inc.",
    "chromeMajor": 150,
    "brands": [
      {
        "brand": "Not;A=Brand",
        "version": "8"
      },
      {
        "brand": "Chromium",
        "version": "150"
      },
      {
        "brand": "Google Chrome",
        "version": "150"
      }
    ],
    "secChUa": "\"Not;A=Brand\";v=\"8\", \"Chromium\";v=\"150\", \"Google Chrome\";v=\"150\"",
    "secChUaPlatform": "Windows",
    "secChUaMobile": "?0",
    "acceptLanguage": "de-DE;q=1.0",
    "screen": {
      "width": 1536,
      "height": 864,
      "dpr": 1.25
    },
    "cores": 8,
    "memoryGb": 8,
    "touchPoints": 0,
    "gpu": {
      "vendor": "Google Inc. (NVIDIA)",
      "renderer": "ANGLE (NVIDIA, NVIDIA GeForce GT 730 (0x00000F02) Direct3D11 vs_5_0 ps_5_0, D3D11)"
    },
    "fonts": [
      "Calibri",
      "Franklin Gothic",
      "MS UI Gothic",
      "MT Extra",
      "Marlett",
      "Segoe UI Light",
      "SimHei"
    ],
    "locale": "de-DE",
    "languages": [
      "de-DE"
    ],
    "dnt": ""
  },
  {
    "id": "real-10",
    "label": "Windows 11 · Edge",
    "os": "Windows",
    "browser": "Edge",
    "mobile": false,
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36 Edg/156.0.0.0",
    "platform": "Win32",
    "oscpu": "",
    "vendor": "Google Inc.",
    "chromeMajor": 156,
    "brands": [
      {
        "brand": "Not:A-Brand",
        "version": "8"
      },
      {
        "brand": "Chromium",
        "version": "156"
      },
      {
        "brand": "Microsoft Edge",
        "version": "156"
      }
    ],
    "secChUa": "\"Not:A-Brand\";v=\"8\", \"Chromium\";v=\"156\", \"Microsoft Edge\";v=\"156\"",
    "secChUaPlatform": "Windows",
    "secChUaMobile": "?0",
    "acceptLanguage": "en-GB;q=1.0",
    "screen": {
      "width": 1366,
      "height": 768,
      "dpr": 1.0
    },
    "cores": 20,
    "memoryGb": 32,
    "touchPoints": 0,
    "gpu": {
      "vendor": "Google Inc. (Intel)",
      "renderer": "ANGLE (Intel, Intel(R) UHD Graphics (0x00009840) Direct3D11 vs_5_0 ps_5_0, D3D11)"
    },
    "fonts": [
      "Agency FB",
      "Calibri",
      "Century",
      "Century Gothic",
      "Franklin Gothic",
      "Haettenschweiler",
      "Leelawadee",
      "Lucida Bright",
      "Lucida Sans",
      "MS Outlook",
      "MS Reference Specialty",
      "MS UI Gothic",
      "MT Extra",
      "Marlett",
      "Microsoft Uighur",
      "Monotype Corsiva",
      "Pristina",
      "Segoe UI Light"
    ],
    "locale": "en-GB",
    "languages": [
      "en-GB"
    ],
    "dnt": ""
  },
  {
    "id": "real-11",
    "label": "Windows 11 · Edge",
    "os": "Windows",
    "browser": "Edge",
    "mobile": false,
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36 Edg/150.0.0.0",
    "platform": "Win32",
    "oscpu": "",
    "vendor": "Google Inc.",
    "chromeMajor": 150,
    "brands": [
      {
        "brand": "Not;A=Brand",
        "version": "8"
      },
      {
        "brand": "Chromium",
        "version": "150"
      },
      {
        "brand": "Microsoft Edge",
        "version": "150"
      }
    ],
    "secChUa": "\"Not;A=Brand\";v=\"8\", \"Chromium\";v=\"150\", \"Microsoft Edge\";v=\"150\"",
    "secChUaPlatform": "Windows",
    "secChUaMobile": "?0",
    "acceptLanguage": "en-GB;q=1.0",
    "screen": {
      "width": 1707,
      "height": 1067,
      "dpr": 1.5
    },
    "cores": 16,
    "memoryGb": 32,
    "touchPoints": 0,
    "gpu": {
      "vendor": "Google Inc. (AMD)",
      "renderer": "ANGLE (AMD, AMD Radeon(TM) 610M (0x000013C0) Direct3D11 vs_5_0 ps_5_0, D3D11)"
    },
    "fonts": [
      "Calibri",
      "Franklin Gothic",
      "MS UI Gothic",
      "Marlett",
      "Segoe UI Light",
      "SimHei"
    ],
    "locale": "en-GB",
    "languages": [
      "en-GB"
    ],
    "dnt": ""
  },
  {
    "id": "real-12",
    "label": "macOS · Apple Silicon",
    "os": "macOS",
    "browser": "Chrome",
    "mobile": false,
    "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36",
    "platform": "MacIntel",
    "oscpu": "",
    "vendor": "Google Inc.",
    "chromeMajor": 156,
    "brands": [
      {
        "brand": "Not:A-Brand",
        "version": "8"
      },
      {
        "brand": "Chromium",
        "version": "156"
      },
      {
        "brand": "Google Chrome",
        "version": "156"
      }
    ],
    "secChUa": "\"Not:A-Brand\";v=\"8\", \"Chromium\";v=\"156\", \"Google Chrome\";v=\"156\"",
    "secChUaPlatform": "macOS",
    "secChUaMobile": "?0",
    "acceptLanguage": "en-US;q=1.0",
    "screen": {
      "width": 1512,
      "height": 982,
      "dpr": 2.0
    },
    "cores": 8,
    "memoryGb": 16,
    "touchPoints": 0,
    "gpu": {
      "vendor": "Google Inc. (Apple)",
      "renderer": "ANGLE (Apple, ANGLE Metal Renderer: Apple M4, Unspecified Version)"
    },
    "fonts": [
      "Arial Unicode MS",
      "Gill Sans",
      "Helvetica Neue",
      "Menlo"
    ],
    "locale": "en-US",
    "languages": [
      "en-US"
    ],
    "dnt": ""
  },
  {
    "id": "real-13",
    "label": "macOS · Apple Silicon",
    "os": "macOS",
    "browser": "Chrome",
    "mobile": false,
    "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36",
    "platform": "MacIntel",
    "oscpu": "",
    "vendor": "Google Inc.",
    "chromeMajor": 150,
    "brands": [
      {
        "brand": "Not;A=Brand",
        "version": "8"
      },
      {
        "brand": "Chromium",
        "version": "150"
      },
      {
        "brand": "Google Chrome",
        "version": "150"
      }
    ],
    "secChUa": "\"Not;A=Brand\";v=\"8\", \"Chromium\";v=\"150\", \"Google Chrome\";v=\"150\"",
    "secChUaPlatform": "macOS",
    "secChUaMobile": "?0",
    "acceptLanguage": "en-US;q=1.0",
    "screen": {
      "width": 1920,
      "height": 1080,
      "dpr": 1.0
    },
    "cores": 2,
    "memoryGb": 16,
    "touchPoints": 0,
    "gpu": {
      "vendor": "Google Inc. (Intel Inc.)",
      "renderer": "ANGLE (Intel Inc., Intel(R) HD Graphics 6000, OpenGL 4.1)"
    },
    "fonts": [
      "Arial Unicode MS",
      "Gill Sans",
      "Helvetica Neue",
      "Menlo"
    ],
    "locale": "en-US",
    "languages": [
      "en-US"
    ],
    "dnt": ""
  },
  {
    "id": "real-14",
    "label": "macOS · Apple Silicon",
    "os": "macOS",
    "browser": "Chrome",
    "mobile": false,
    "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36",
    "platform": "MacIntel",
    "oscpu": "",
    "vendor": "Google Inc.",
    "chromeMajor": 151,
    "brands": [
      {
        "brand": "Not=A?Brand",
        "version": "99"
      },
      {
        "brand": "Google Chrome",
        "version": "151"
      },
      {
        "brand": "Chromium",
        "version": "151"
      }
    ],
    "secChUa": "\"Not=A?Brand\";v=\"99\", \"Google Chrome\";v=\"151\", \"Chromium\";v=\"151\"",
    "secChUaPlatform": "macOS",
    "secChUaMobile": "?0",
    "acceptLanguage": "en-US;q=1.0",
    "screen": {
      "width": 1920,
      "height": 1080,
      "dpr": 1.0
    },
    "cores": 16,
    "memoryGb": 16,
    "touchPoints": 0,
    "gpu": {
      "vendor": "Google Inc. (Apple)",
      "renderer": "ANGLE (Apple, ANGLE Metal Renderer: Apple M5, Unspecified Version)"
    },
    "fonts": [
      "Arial Unicode MS",
      "Gill Sans",
      "Helvetica Neue",
      "Menlo"
    ],
    "locale": "en-US",
    "languages": [
      "en-US"
    ],
    "dnt": ""
  },
  {
    "id": "real-15",
    "label": "macOS · Apple Silicon",
    "os": "macOS",
    "browser": "Chrome",
    "mobile": false,
    "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36",
    "platform": "MacIntel",
    "oscpu": "",
    "vendor": "Google Inc.",
    "chromeMajor": 155,
    "brands": [
      {
        "brand": "Google Chrome",
        "version": "155"
      },
      {
        "brand": "Chromium",
        "version": "155"
      },
      {
        "brand": "Not(A:Brand",
        "version": "24"
      }
    ],
    "secChUa": "\"Google Chrome\";v=\"155\", \"Chromium\";v=\"155\", \"Not(A:Brand\";v=\"24\"",
    "secChUaPlatform": "macOS",
    "secChUaMobile": "?0",
    "acceptLanguage": "en-US;q=1.0",
    "screen": {
      "width": 1710,
      "height": 1107,
      "dpr": 2.0
    },
    "cores": 8,
    "memoryGb": 16,
    "touchPoints": 0,
    "gpu": {
      "vendor": "Google Inc. (Apple)",
      "renderer": "ANGLE (Apple, ANGLE Metal Renderer: Apple M3 Pro, Unspecified Version)"
    },
    "fonts": [
      "Arial Unicode MS",
      "Gill Sans",
      "Helvetica Neue",
      "Menlo"
    ],
    "locale": "en-US",
    "languages": [
      "en-US"
    ],
    "dnt": ""
  },
  {
    "id": "real-16",
    "label": "macOS · Intel",
    "os": "macOS",
    "browser": "Chrome",
    "mobile": false,
    "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36",
    "platform": "MacIntel",
    "oscpu": "",
    "vendor": "Google Inc.",
    "chromeMajor": 154,
    "brands": [
      {
        "brand": "Chromium",
        "version": "154"
      },
      {
        "brand": "Google Chrome",
        "version": "154"
      },
      {
        "brand": "Not A(Brand",
        "version": "99"
      }
    ],
    "secChUa": "\"Chromium\";v=\"154\", \"Google Chrome\";v=\"154\", \"Not A(Brand\";v=\"99\"",
    "secChUaPlatform": "macOS",
    "secChUaMobile": "?0",
    "acceptLanguage": "en-GB;q=1.0",
    "screen": {
      "width": 1512,
      "height": 982,
      "dpr": 1.600000023841858
    },
    "cores": 10,
    "memoryGb": 16,
    "touchPoints": 0,
    "gpu": {
      "vendor": "Google Inc. (Apple)",
      "renderer": "ANGLE (Apple, ANGLE Metal Renderer: Apple M4, Unspecified Version)"
    },
    "fonts": [
      "Arial Unicode MS",
      "Gill Sans",
      "Helvetica Neue",
      "Menlo"
    ],
    "locale": "en-GB",
    "languages": [
      "en-GB"
    ],
    "dnt": ""
  },
  {
    "id": "real-17",
    "label": "macOS · Intel",
    "os": "macOS",
    "browser": "Chrome",
    "mobile": false,
    "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36",
    "platform": "MacIntel",
    "oscpu": "",
    "vendor": "Google Inc.",
    "chromeMajor": 157,
    "brands": [
      {
        "brand": "Not-A.Brand",
        "version": "99"
      },
      {
        "brand": "Google Chrome",
        "version": "157"
      },
      {
        "brand": "Chromium",
        "version": "157"
      }
    ],
    "secChUa": "\"Not-A.Brand\";v=\"99\", \"Google Chrome\";v=\"157\", \"Chromium\";v=\"157\"",
    "secChUaPlatform": "macOS",
    "secChUaMobile": "?0",
    "acceptLanguage": "en-GB;q=1.0",
    "screen": {
      "width": 1440,
      "height": 900,
      "dpr": 2.0
    },
    "cores": 12,
    "memoryGb": 32,
    "touchPoints": 0,
    "gpu": {
      "vendor": "Google Inc. (Intel)",
      "renderer": "ANGLE (Intel, ANGLE Metal Renderer: Intel(R) Iris(TM) Plus Graphics, Unspecified Version)"
    },
    "fonts": [
      "Arial Unicode MS",
      "Calibri",
      "Gill Sans",
      "Helvetica Neue",
      "Menlo",
      "MS Mincho"
    ],
    "locale": "en-GB",
    "languages": [
      "en-GB"
    ],
    "dnt": ""
  },
  {
    "id": "real-18",
    "label": "Linux · Desktop",
    "os": "Linux",
    "browser": "Chrome",
    "mobile": false,
    "userAgent": "Mozilla/5.0 (X11; Ubuntu; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36",
    "platform": "Linux x86_64",
    "oscpu": "",
    "vendor": "Google Inc.",
    "chromeMajor": 156,
    "brands": [
      {
        "brand": "Not:A-Brand",
        "version": "8"
      },
      {
        "brand": "Chromium",
        "version": "156"
      }
    ],
    "secChUa": "\"Not:A-Brand\";v=\"8\", \"Chromium\";v=\"156\"",
    "secChUaPlatform": "Linux",
    "secChUaMobile": "?0",
    "acceptLanguage": "en-GB;q=1.0",
    "screen": {
      "width": 1920,
      "height": 1080,
      "dpr": 1.0
    },
    "cores": 8,
    "memoryGb": 16,
    "touchPoints": 0,
    "gpu": {
      "vendor": "Google Inc. (Intel)",
      "renderer": "ANGLE (Intel, Mesa Intel(R) UHD Graphics 620 (WHL GT2), OpenGL ES 3.2)"
    },
    "fonts": [
      "Arial",
      "DejaVu Sans",
      "Liberation Sans",
      "Noto Sans",
      "Ubuntu"
    ],
    "locale": "en-GB",
    "languages": [
      "en-GB"
    ],
    "dnt": ""
  },
  {
    "id": "real-19",
    "label": "Linux · Desktop",
    "os": "Linux",
    "browser": "Chrome",
    "mobile": false,
    "userAgent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36",
    "platform": "Linux x86_64",
    "oscpu": "",
    "vendor": "Google Inc.",
    "chromeMajor": 156,
    "brands": [
      {
        "brand": "Not:A-Brand",
        "version": "8"
      },
      {
        "brand": "Chromium",
        "version": "156"
      },
      {
        "brand": "Google Chrome",
        "version": "156"
      }
    ],
    "secChUa": "\"Not:A-Brand\";v=\"8\", \"Chromium\";v=\"156\", \"Google Chrome\";v=\"156\"",
    "secChUaPlatform": "Linux",
    "secChUaMobile": "?0",
    "acceptLanguage": "en-GB;q=1.0",
    "screen": {
      "width": 3840,
      "height": 1600,
      "dpr": 1.0
    },
    "cores": 8,
    "memoryGb": 32,
    "touchPoints": 0,
    "gpu": {
      "vendor": "Google Inc. (Intel)",
      "renderer": "ANGLE (Intel, Mesa Intel(R) HD Graphics 5500 (BDW GT2), OpenGL ES 3.2)"
    },
    "fonts": [
      "Arial",
      "DejaVu Sans",
      "Liberation Sans",
      "Noto Sans",
      "Ubuntu"
    ],
    "locale": "en-GB",
    "languages": [
      "en-GB"
    ],
    "dnt": ""
  },
  {
    "id": "real-20",
    "label": "Linux · Desktop",
    "os": "Linux",
    "browser": "Chrome",
    "mobile": false,
    "userAgent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36",
    "platform": "Linux x86_64",
    "oscpu": "",
    "vendor": "Google Inc.",
    "chromeMajor": 151,
    "brands": [
      {
        "brand": "Not=A?Brand",
        "version": "99"
      },
      {
        "brand": "Google Chrome",
        "version": "151"
      },
      {
        "brand": "Chromium",
        "version": "151"
      }
    ],
    "secChUa": "\"Not=A?Brand\";v=\"99\", \"Google Chrome\";v=\"151\", \"Chromium\";v=\"151\"",
    "secChUaPlatform": "Linux",
    "secChUaMobile": "?0",
    "acceptLanguage": "en-GB;q=1.0",
    "screen": {
      "width": 2560,
      "height": 1440,
      "dpr": 1.25
    },
    "cores": 8,
    "memoryGb": 16,
    "touchPoints": 0,
    "gpu": {
      "vendor": "Google Inc. (AMD)",
      "renderer": "ANGLE (AMD, AMD Radeon RX 6800 XT (radeonsi navi21 ACO), OpenGL ES 3.2)"
    },
    "fonts": [
      "Arial",
      "DejaVu Sans",
      "Liberation Sans",
      "Noto Sans",
      "Ubuntu"
    ],
    "locale": "en-GB",
    "languages": [
      "en-GB"
    ],
    "dnt": ""
  },
  {
    "id": "real-21",
    "label": "Android · Pixel",
    "os": "Android",
    "browser": "Chrome",
    "mobile": true,
    "userAgent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Mobile Safari/537.36",
    "platform": "Linux armv81",
    "oscpu": "",
    "vendor": "Google Inc.",
    "chromeMajor": 156,
    "brands": [
      {
        "brand": "Not:A-Brand",
        "version": "8"
      },
      {
        "brand": "Chromium",
        "version": "156"
      },
      {
        "brand": "Google Chrome",
        "version": "156"
      }
    ],
    "secChUa": "\"Not:A-Brand\";v=\"8\", \"Chromium\";v=\"156\", \"Google Chrome\";v=\"156\"",
    "secChUaPlatform": "Android",
    "secChUaMobile": "?1",
    "acceptLanguage": "en-US;q=1.0",
    "screen": {
      "width": 384,
      "height": 811,
      "dpr": 2.8125
    },
    "cores": 8,
    "memoryGb": 8,
    "touchPoints": 5,
    "gpu": {
      "vendor": "Google Inc. (Qualcomm)",
      "renderer": "ANGLE (Qualcomm, Adreno (TM) 640, OpenGL ES 3.2)"
    },
    "fonts": [
      "Arial",
      "Noto Sans",
      "Roboto",
      "Droid Sans",
      "Droid Serif"
    ],
    "locale": "en-US",
    "languages": [
      "en-US"
    ],
    "dnt": ""
  },
  {
    "id": "real-22",
    "label": "Android · Pixel",
    "os": "Android",
    "browser": "Chrome",
    "mobile": true,
    "userAgent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Mobile Safari/537.36",
    "platform": "Linux armv81",
    "oscpu": "",
    "vendor": "Google Inc.",
    "chromeMajor": 157,
    "brands": [
      {
        "brand": "Not-A.Brand",
        "version": "99"
      },
      {
        "brand": "Google Chrome",
        "version": "157"
      },
      {
        "brand": "Chromium",
        "version": "157"
      }
    ],
    "secChUa": "\"Not-A.Brand\";v=\"99\", \"Google Chrome\";v=\"157\", \"Chromium\";v=\"157\"",
    "secChUaPlatform": "Android",
    "secChUaMobile": "?1",
    "acceptLanguage": "en-US;q=1.0",
    "screen": {
      "width": 400,
      "height": 870,
      "dpr": 3.0
    },
    "cores": 8,
    "memoryGb": 8,
    "touchPoints": 5,
    "gpu": {
      "vendor": "Google Inc. (Qualcomm)",
      "renderer": "ANGLE (Qualcomm, Adreno (TM) 619, OpenGL ES 3.2)"
    },
    "fonts": [
      "Arial",
      "Noto Sans",
      "Roboto",
      "Droid Sans",
      "Droid Serif"
    ],
    "locale": "en-US",
    "languages": [
      "en-US"
    ],
    "dnt": ""
  },
  {
    "id": "real-23",
    "label": "Android · Pixel",
    "os": "Android",
    "browser": "Chrome",
    "mobile": true,
    "userAgent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36",
    "platform": "Linux armv81",
    "oscpu": "",
    "vendor": "Google Inc.",
    "chromeMajor": 151,
    "brands": [
      {
        "brand": "Not=A?Brand",
        "version": "99"
      },
      {
        "brand": "Google Chrome",
        "version": "151"
      },
      {
        "brand": "Chromium",
        "version": "151"
      }
    ],
    "secChUa": "\"Not=A?Brand\";v=\"99\", \"Google Chrome\";v=\"151\", \"Chromium\";v=\"151\"",
    "secChUaPlatform": "Android",
    "secChUaMobile": "?1",
    "acceptLanguage": "en-US;q=1.0",
    "screen": {
      "width": 393,
      "height": 851,
      "dpr": 2.75
    },
    "cores": 8,
    "memoryGb": 4,
    "touchPoints": 5,
    "gpu": {
      "vendor": "Google Inc. (Qualcomm)",
      "renderer": "ANGLE (Qualcomm, Adreno (TM) 610, OpenGL ES 3.2)"
    },
    "fonts": [
      "Arial",
      "Noto Sans",
      "Roboto",
      "Droid Sans",
      "Droid Serif"
    ],
    "locale": "en-US",
    "languages": [
      "en-US"
    ],
    "dnt": ""
  },
  {
    "id": "real-24",
    "label": "Android · Pixel",
    "os": "Android",
    "browser": "Chrome",
    "mobile": true,
    "userAgent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Mobile Safari/537.36",
    "platform": "Linux armv81",
    "oscpu": "",
    "vendor": "Google Inc.",
    "chromeMajor": 153,
    "brands": [
      {
        "brand": "Google Chrome",
        "version": "153"
      },
      {
        "brand": "Not_A Brand",
        "version": "8"
      },
      {
        "brand": "Chromium",
        "version": "153"
      }
    ],
    "secChUa": "\"Google Chrome\";v=\"153\", \"Not_A Brand\";v=\"8\", \"Chromium\";v=\"153\"",
    "secChUaPlatform": "Android",
    "secChUaMobile": "?1",
    "acceptLanguage": "en-US;q=1.0",
    "screen": {
      "width": 569,
      "height": 874,
      "dpr": 2.8125
    },
    "cores": 8,
    "memoryGb": 8,
    "touchPoints": 5,
    "gpu": {
      "vendor": "Google Inc. (Imagination Technologies)",
      "renderer": "ANGLE (Imagination Technologies, PowerVR Rogue GE8320, OpenGL ES 3.2)"
    },
    "fonts": [
      "Arial",
      "Noto Sans",
      "Roboto",
      "Droid Sans",
      "Droid Serif"
    ],
    "locale": "en-US",
    "languages": [
      "en-US"
    ],
    "dnt": ""
  },
  {
    "id": "real-25",
    "label": "Android · Pixel",
    "os": "Android",
    "browser": "Chrome",
    "mobile": true,
    "userAgent": "Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Mobile Safari/537.36",
    "platform": "Linux x86_64",
    "oscpu": "",
    "vendor": "Google Inc.",
    "chromeMajor": 156,
    "brands": [
      {
        "brand": "Chromium",
        "version": "156"
      },
      {
        "brand": "Google Chrome",
        "version": "156"
      }
    ],
    "secChUa": "\"Chromium\";v=\"156\", \"Google Chrome\";v=\"156\"",
    "secChUaPlatform": "Android",
    "secChUaMobile": "?1",
    "acceptLanguage": "en-US;q=1.0",
    "screen": {
      "width": 412,
      "height": 823,
      "dpr": 1.75
    },
    "cores": 8,
    "memoryGb": 32,
    "touchPoints": 1,
    "gpu": {
      "vendor": "Google Inc. (Google)",
      "renderer": "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)"
    },
    "fonts": [
      "Arial",
      "Noto Sans",
      "Roboto",
      "Droid Sans",
      "Droid Serif"
    ],
    "locale": "en-US",
    "languages": [
      "en-US"
    ],
    "dnt": ""
  },
  {
    "id": "real-26",
    "label": "Android · Galaxy",
    "os": "Android",
    "browser": "Chrome",
    "mobile": true,
    "userAgent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/158.0.0.0 Mobile Safari/537.36",
    "platform": "Linux armv81",
    "oscpu": "",
    "vendor": "Google Inc.",
    "chromeMajor": 158,
    "brands": [
      {
        "brand": "Chromium",
        "version": "158"
      },
      {
        "brand": "Not.A/Brand",
        "version": "24"
      },
      {
        "brand": "Google Chrome",
        "version": "158"
      }
    ],
    "secChUa": "\"Chromium\";v=\"158\", \"Not.A/Brand\";v=\"24\", \"Google Chrome\";v=\"158\"",
    "secChUaPlatform": "Android",
    "secChUaMobile": "?1",
    "acceptLanguage": "en-SG;q=1.0",
    "screen": {
      "width": 394,
      "height": 853,
      "dpr": 3.25
    },
    "cores": 8,
    "memoryGb": 8,
    "touchPoints": 5,
    "gpu": {
      "vendor": "Google Inc. (ARM)",
      "renderer": "ANGLE (ARM, Mali-G57 MC2, OpenGL ES 3.2)"
    },
    "fonts": [
      "Arial",
      "Noto Sans",
      "Roboto",
      "Droid Sans",
      "Droid Serif"
    ],
    "locale": "en-SG",
    "languages": [
      "en-SG"
    ],
    "dnt": ""
  },
  {
    "id": "real-27",
    "label": "Android · Galaxy",
    "os": "Android",
    "browser": "Chrome",
    "mobile": true,
    "userAgent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Mobile Safari/537.36",
    "platform": "Linux armv81",
    "oscpu": "",
    "vendor": "Google Inc.",
    "chromeMajor": 154,
    "brands": [
      {
        "brand": "Chromium",
        "version": "154"
      },
      {
        "brand": "Google Chrome",
        "version": "154"
      },
      {
        "brand": "Not A(Brand",
        "version": "99"
      }
    ],
    "secChUa": "\"Chromium\";v=\"154\", \"Google Chrome\";v=\"154\", \"Not A(Brand\";v=\"99\"",
    "secChUaPlatform": "Android",
    "secChUaMobile": "?1",
    "acceptLanguage": "en-SG;q=1.0",
    "screen": {
      "width": 360,
      "height": 792,
      "dpr": 3.0
    },
    "cores": 8,
    "memoryGb": 4,
    "touchPoints": 5,
    "gpu": {
      "vendor": "Google Inc. (ARM)",
      "renderer": "ANGLE (ARM, Mali-G51, OpenGL ES 3.2)"
    },
    "fonts": [
      "Arial",
      "Noto Sans",
      "Roboto",
      "Droid Sans",
      "Droid Serif"
    ],
    "locale": "en-SG",
    "languages": [
      "en-SG"
    ],
    "dnt": ""
  },
  {
    "id": "real-28",
    "label": "Android · Galaxy",
    "os": "Android",
    "browser": "Chrome",
    "mobile": true,
    "userAgent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36",
    "platform": "Linux armv81",
    "oscpu": "",
    "vendor": "Google Inc.",
    "chromeMajor": 155,
    "brands": [
      {
        "brand": "Google Chrome",
        "version": "155"
      },
      {
        "brand": "Chromium",
        "version": "155"
      },
      {
        "brand": "Not(A:Brand",
        "version": "24"
      }
    ],
    "secChUa": "\"Google Chrome\";v=\"155\", \"Chromium\";v=\"155\", \"Not(A:Brand\";v=\"24\"",
    "secChUaPlatform": "Android",
    "secChUaMobile": "?1",
    "acceptLanguage": "en-SG;q=1.0",
    "screen": {
      "width": 360,
      "height": 812,
      "dpr": 3.0
    },
    "cores": 8,
    "memoryGb": 8,
    "touchPoints": 5,
    "gpu": {
      "vendor": "Google Inc. (Imagination Technologies)",
      "renderer": "ANGLE (Imagination Technologies, PowerVR Rogue GE8320, OpenGL ES 3.2)"
    },
    "fonts": [
      "Arial",
      "Noto Sans",
      "Roboto",
      "Droid Sans",
      "Droid Serif"
    ],
    "locale": "en-SG",
    "languages": [
      "en-SG"
    ],
    "dnt": ""
  },
  {
    "id": "real-29",
    "label": "Android · Galaxy",
    "os": "Android",
    "browser": "Chrome",
    "mobile": true,
    "userAgent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36",
    "platform": "Linux armv81",
    "oscpu": "",
    "vendor": "Google Inc.",
    "chromeMajor": 143,
    "brands": [
      {
        "brand": "Google Chrome",
        "version": "143"
      },
      {
        "brand": "Chromium",
        "version": "143"
      },
      {
        "brand": "Not A(Brand",
        "version": "24"
      }
    ],
    "secChUa": "\"Google Chrome\";v=\"143\", \"Chromium\";v=\"143\", \"Not A(Brand\";v=\"24\"",
    "secChUaPlatform": "Android",
    "secChUaMobile": "?1",
    "acceptLanguage": "en-SG;q=1.0",
    "screen": {
      "width": 433,
      "height": 939,
      "dpr": 2.8125
    },
    "cores": 8,
    "memoryGb": 8,
    "touchPoints": 5,
    "gpu": {
      "vendor": "Samsung Electronics Co., Ltd.",
      "renderer": "ANGLE ((Samsung Xclipse 540) on Vulkan 1.3.279)"
    },
    "fonts": [
      "Arial",
      "Noto Sans",
      "Roboto",
      "Droid Sans",
      "Droid Serif"
    ],
    "locale": "en-SG",
    "languages": [
      "en-SG"
    ],
    "dnt": ""
  }
];

export const FINGERPRINT_DATA_SOURCE = 'Apify fingerprint-suite / BrowserForge (Apache-2.0)';

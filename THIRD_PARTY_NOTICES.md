# Third-party software

## liquid-glass

The unmodified `public/vendor/liquid-glass.js` is from [deepika-builds/liquid-glass](https://github.com/deepika-builds/liquid-glass), pinned to commit [`98ed97bd99def529493fd37177228810f6422f6d`](https://github.com/deepika-builds/liquid-glass/tree/98ed97bd99def529493fd37177228810f6422f6d).

Copyright © 2026 Deepika Rao. Distributed under the MIT License; the complete notice is retained in [public/vendor/liquid-glass.LICENSE](public/vendor/liquid-glass.LICENSE).

Folio initializes the original DOM API from a React effect and destroys instances on removal/unmount. It applies the library to the floating toolbar, summary cards, order-flow card, symbol cards, dropdowns and dialog. Large chart/table surfaces retain CSS frosted glass rather than creating large SVG displacement maps. Source updates are deliberate and pinned; no third-party script is fetched at runtime.

The upstream provides SVG refraction for supported Chromium browsers and a frosted-blur fallback for Safari/Firefox. The appearance is decorative; labels and interactions remain usable without the refraction effect.

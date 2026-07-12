# Changelog

All notable changes to this project will be documented in this file.

## [0.7.0](https://github.com/cascading-jox/vittra/compare/v0.6.0...v0.7.0) (2026-07-12)


### Features

* capture tfa operations in the black box below the print level ([8414dda](https://github.com/cascading-jox/vittra/commit/8414dda40be0b22ef05376f0f981e64b7d6f8323))
* throttle option rate-limiting printed output ([8414dda](https://github.com/cascading-jox/vittra/commit/8414dda40be0b22ef05376f0f981e64b7d6f8323))

## [0.6.0](https://github.com/cascading-jox/vittra/compare/v0.5.0...v0.6.0) (2026-07-12)


### Features

* ignore-list vittra in shipped source maps ([1ac194c](https://github.com/cascading-jox/vittra/commit/1ac194c7a11eddece4e59c001c5e86486da23f91))
* named instances with per-namespace log level specs ([9208e0b](https://github.com/cascading-jox/vittra/commit/9208e0bf21eea641cf59152f1ccb62765ef13e17))
* perfMarks option surfacing traces in the DevTools Performance timeline ([9645a9d](https://github.com/cascading-jox/vittra/commit/9645a9d8124196b1a77f779d57903e4bd9c4a89c))
* ring buffer with dump(), onEntry hook, dumpOnError, and blackBox capture ([f786998](https://github.com/cascading-jox/vittra/commit/f786998adae324a9e5ef6b62f6eb3ca9dad9ac10))
* share async operation ids across all instances ([61de949](https://github.com/cascading-jox/vittra/commit/61de94974d0cd0e287aecd6e250ce0c32eefc86d))


### Bug Fixes

* apply a runtime level spec to instances constructed after it is set ([00ab38a](https://github.com/cascading-jox/vittra/commit/00ab38aadda39c1116ab74cdf2bde3c859102353))
* close only console groups that actually printed ([00ab38a](https://github.com/cascading-jox/vittra/commit/00ab38aadda39c1116ab74cdf2bde3c859102353))
* defer download blob URL revocation until the save completes ([00ab38a](https://github.com/cascading-jox/vittra/commit/00ab38aadda39c1116ab74cdf2bde3c859102353))
* drop empty trailing argument from console calls when logTime is off ([f02ca46](https://github.com/cascading-jox/vittra/commit/f02ca4695e426af24e81feb753052b50302a07c6))
* embed source text in the published source map ([1ac194c](https://github.com/cascading-jox/vittra/commit/1ac194c7a11eddece4e59c001c5e86486da23f91))
* end perfMarks spans for nested operations at their completion ([00ab38a](https://github.com/cascading-jox/vittra/commit/00ab38aadda39c1116ab74cdf2bde3c859102353))
* evict the oldest orphaned tfia operation past a pending cap ([f02ca46](https://github.com/cascading-jox/vittra/commit/f02ca4695e426af24e81feb753052b50302a07c6))
* make dump() crash-proof against unstringifiable and circular values ([00ab38a](https://github.com/cascading-jox/vittra/commit/00ab38aadda39c1116ab74cdf2bde3c859102353))
* persist explicit zero levels so wildcards cannot re-enable logging ([00ab38a](https://github.com/cascading-jox/vittra/commit/00ab38aadda39c1116ab74cdf2bde3c859102353))
* print the startup banner once per page load ([61de949](https://github.com/cascading-jox/vittra/commit/61de94974d0cd0e287aecd6e250ce0c32eefc86d))
* separate logWithType format specifiers with spaces ([f02ca46](https://github.com/cascading-jox/vittra/commit/f02ca4695e426af24e81feb753052b50302a07c6))
* snapshot table data at capture time ([00ab38a](https://github.com/cascading-jox/vittra/commit/00ab38aadda39c1116ab74cdf2bde3c859102353))


### Miscellaneous Chores

* **demo:** rebuild the demo as a feature playground ([42844a8](https://github.com/cascading-jox/vittra/commit/42844a87a6484ba6dc1beb7dc3d930d775bd6eec))


### Code Refactoring

* remove unreachable branches in tfi, tfo, and logToConsole ([f02ca46](https://github.com/cascading-jox/vittra/commit/f02ca4695e426af24e81feb753052b50302a07c6))
* route all trace output through one emit/print path ([88f3e0f](https://github.com/cascading-jox/vittra/commit/88f3e0fb92e0fee9f73acd887752af340acf6cb3))


### Build System

* add per-call benchmark suite and attw published-types check ([37d0033](https://github.com/cascading-jox/vittra/commit/37d0033e24508a88fceaf7f91c816614d1516234))

## [0.5.0](https://github.com/cascading-jox/vittra/compare/v0.4.0...v0.5.0) (2026-07-10)


### Features

* show a startup banner when logging is enabled ([5676e91](https://github.com/cascading-jox/vittra/commit/5676e9170074897577f88e3f45ba576578905e5a))


### Bug Fixes

* declare types in the exports map and drop the engines field ([7db9291](https://github.com/cascading-jox/vittra/commit/7db92913b9c525059124b52f6e1e322d9b8fcc30))


### Continuous Integration

* match release tags without component prefix ([2a24945](https://github.com/cascading-jox/vittra/commit/2a24945210a2f7f0acd50e8c8bf06594026aff53))
* run release-please in manifest mode ([17650c7](https://github.com/cascading-jox/vittra/commit/17650c72a0f47713572c62dc3db5c64fca9e106b))

## [0.4.0](https://github.com/cascading-jox/vittra/compare/v0.3.0...v0.4.0) (2026-07-10)


### ⚠ BREAKING CHANGES

* log level 1 now shows only warnings and errors; use level 2 for the full trace

### Features

* add tfa async wrapper with buffered per-operation logs ([761b5db](https://github.com/cascading-jox/vittra/commit/761b5db9ff53b0561b3043dc6ae081c3ce52eb3e))
* add tfat async operations table and checkUnclosedAsyncOps ([761b5db](https://github.com/cascading-jox/vittra/commit/761b5db9ff53b0561b3043dc6ae081c3ce52eb3e))
* gate output by log level ([761b5db](https://github.com/cascading-jox/vittra/commit/761b5db9ff53b0561b3043dc6ae081c3ce52eb3e))


### Bug Fixes

* replace async indentation with per-operation ids and colors ([761b5db](https://github.com/cascading-jox/vittra/commit/761b5db9ff53b0561b3043dc6ae081c3ce52eb3e))

## [0.3.0](https://github.com/cascading-jox/vittra/compare/v0.2.4...v0.3.0) (2026-07-10)


### Features

* add reset method to clear all tracing state ([e57f8c7](https://github.com/cascading-jox/vittra/commit/e57f8c7d96df42d245aaaee635546b9321921e45))
* add setLogLevel runtime setter with opt-in persistence ([e57f8c7](https://github.com/cascading-jox/vittra/commit/e57f8c7d96df42d245aaaee635546b9321921e45))


### Bug Fixes

* auto-close unclosed functions on mismatched tfo calls ([e57f8c7](https://github.com/cascading-jox/vittra/commit/e57f8c7d96df42d245aaaee635546b9321921e45))
* prevent log calls from throwing and preserve Error values ([e57f8c7](https://github.com/cascading-jox/vittra/commit/e57f8c7d96df42d245aaaee635546b9321921e45))
* zero-pad milliseconds in formatTime durations ([e57f8c7](https://github.com/cascading-jox/vittra/commit/e57f8c7d96df42d245aaaee635546b9321921e45))

## [0.2.4](https://github.com/cascading-jox/vittra/compare/v0.2.3...v0.2.4) (2025-01-17)


### Bug Fixes

* remove tripple slash for jsr compatibility ([ee7788e](https://github.com/cascading-jox/vittra/commit/ee7788e9dec3ca3c33e07b4ab91aaabc1d00a9da))

## [0.2.3](https://github.com/cascading-jox/vittra/compare/v0.2.2...v0.2.3) (2025-01-17)


### Features

* add support for URL param override for logLevel ([d8ba490](https://github.com/cascading-jox/vittra/commit/d8ba490d225c5d9978142a95da6266da0b404bc7))
* initial commit ([10c7e88](https://github.com/cascading-jox/vittra/commit/10c7e88b7ba62297ec9b5bf4114fd8f127bb2282))


### Bug Fixes

* ci trigger commit ([b7e523e](https://github.com/cascading-jox/vittra/commit/b7e523e8d99a84f8a46628ec148aef0fdedf9fc9))
* fix changelog and trigger ci ([b4e2767](https://github.com/cascading-jox/vittra/commit/b4e27675d404a41f05c4eb56e283e6f435cefb6b))
* remove extra space before logging objects ([d01665a](https://github.com/cascading-jox/vittra/commit/d01665afbcb73efe722b6a579e906570a80a5abe))
* trigger ci ([5056318](https://github.com/cascading-jox/vittra/commit/50563182564aa19bc934940b3bd154f75f3a0fce))
* trigger ci ([e831809](https://github.com/cascading-jox/vittra/commit/e831809eb6bdb2dd3976ffcd7a287d49c2f6d9fb))
* trigger ci ([edb741a](https://github.com/cascading-jox/vittra/commit/edb741ab6ee8217ebd1c8785d5ccec006d82aa41))
* trigger ci ([7b25953](https://github.com/cascading-jox/vittra/commit/7b25953dc7398802bcbcb2270f8e1deda3bad6c2))
* update changelog with missing commits & trigger ci ([56f142d](https://github.com/cascading-jox/vittra/commit/56f142ded0579b256073f2a5a55c95fd179ae46a))


### Miscellaneous Chores

* release 0.2.2 ([12afd9c](https://github.com/cascading-jox/vittra/commit/12afd9c13a28852d9247067076544c97240039ac))
* release 0.2.3 ([ab1fc73](https://github.com/cascading-jox/vittra/commit/ab1fc7329d210077926621a8d71b44d892d5751c))

## [0.2.2](https://github.com/cascading-jox/vittra/compare/v0.2.2...v0.2.2) (2025-01-17)

### Bug Fixes

* ci trigger commit ([b7e523e](https://github.com/cascading-jox/vittra/commit/b7e523e8d99a84f8a46628ec148aef0fdedf9fc9))
* fix changelog and trigger ci ([b4e2767](https://github.com/cascading-jox/vittra/commit/b4e27675d404a41f05c4eb56e283e6f435cefb6b))
* remove extra space before logging objects ([d01665a](https://github.com/cascading-jox/vittra/commit/d01665afbcb73efe722b6a579e906570a80a5abe))
* trigger ci ([e831809](https://github.com/cascading-jox/vittra/commit/e831809eb6bdb2dd3976ffcd7a287d49c2f6d9fb))
* trigger ci ([edb741a](https://github.com/cascading-jox/vittra/commit/edb741ab6ee8217ebd1c8785d5ccec006d82aa41))
* trigger ci ([7b25953](https://github.com/cascading-jox/vittra/commit/7b25953dc7398802bcbcb2270f8e1deda3bad6c2))
* update changelog with missing commits & trigger ci ([56f142d](https://github.com/cascading-jox/vittra/commit/56f142ded0579b256073f2a5a55c95fd179ae46a))


### Miscellaneous Chores

* release 0.2.2 ([12afd9c](https://github.com/cascading-jox/vittra/commit/12afd9c13a28852d9247067076544c97240039ac))

## [0.2.2](https://github.com/cascading-jox/vittra/compare/v0.2.1...v0.2.2) (2025-01-17)

### Bug Fixes

* ci trigger commit ([b7e523e](https://github.com/cascading-jox/vittra/commit/b7e523e8d99a84f8a46628ec148aef0fdedf9fc9))

## [0.2.1](https://github.com/cascading-jox/vittra/compare/v0.2.0...v0.2.1) (2025-01-17)

### Bug Fixes

* remove extra space before logging objects ([d01665a](https://github.com/cascading-jox/vittra/commit/d01665afbcb73efe722b6a579e906570a80a5abe))

## [0.2.0](https://github.com/cascading-jox/vittra/compare/v0.1.0...v0.2.0) (2025-01-17)

### Features

* add support for URL param override for logLevel ([d8ba490](https://github.com/cascading-jox/vittra/commit/d8ba490d225c5d9978142a95da6266da0b404bc7))

## [0.1.0](https://github.com/cascading-jox/vittra/commits/v0.1.0) (2025-01-16)

### Features

* initial commit ([10c7e88](https://github.com/cascading-jox/vittra/commit/10c7e88b7ba62297ec9b5bf4114fd8f127bb2282))

#### Core Features
* Context-aware depth tracking for nested function calls
* Automatic console group-based indentation for improved readability
* Configurable debug level control
* Optional time tracking with delta time display

#### Logging Functions
* `tfi()` - Function entry logging with argument capture
* `tfo()` - Function exit logging with return value display
* `tf()` - Standard logging with + prefix
* `tfc()` - Clean logging without formatting
* `tfw()` - Warning level logging
* `tfe()` - Error level logging
* `tft()` - Table format logging

#### Time Tracking
* Automatic function execution time measurement
* Smart time formatting (ms, s, mm:ss)
* Delta time display between log entries

#### Async Support
* `tfia()` - Async function entry logging
* `tfoa()` - Async function exit logging

#### Input Support
* Rich object and array formatting
* Multi-argument logging
* Primitive type handling (strings, numbers, etc.)

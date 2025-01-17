# Changelog

All notable changes to this project will be documented in this file.

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

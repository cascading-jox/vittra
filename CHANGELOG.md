# Changelog

All notable changes to this project will be documented in this file.

## [0.2.0](https://github.com/cascading-jox/av-log/compare/v0.1.0...v0.2.0) (2025-01-17)

### Features

* add support for URL param override for logLevel ([d8ba490](https://github.com/cascading-jox/av-log/commit/d8ba490d225c5d9978142a95da6266da0b404bc7))

## [0.1.0](https://github.com/cascading-jox/av-log/commits/v0.1.0) (2025-01-16)

### Features

Initial release of av-log:

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


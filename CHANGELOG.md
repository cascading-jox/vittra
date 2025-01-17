# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [0.2.0](https://github.com/cascading-jox/av-log/compare/v0.1.0...v0.2.0) (2025-01-17)

### Features

* add support for URL param override for logLevel ([24b91f9](https://github.com/cascading-jox/av-log/commit/24b91f96712bf9306331fa8550f61db3560bd89a))

## [0.1.0](https://github.com/cascading-jox/av-log/commits/v0.1.0) (2025-01-16)

### Features

* Core logging functionality with context-aware depth tracking
* Logging functions:
    * `tfi()`: Function entry logging with arguments
    * `tfo()`: Function exit logging with return values
    * `tf()`: Standard logging with + prefix
    * `tfc()`: Clean logging without formatting
    * `tfw()`: Warning logging
    * `tfe()`: Error logging
    * `tft()`: Table logging
* Time tracking features:
    * Optional time logging for function calls
    * Delta time display
    * Automatic time formatting (ms, s, mm:ss)
* Configuration options:
    * Debug level control
    * Time logging toggle
    * Type formatting toggle
* Console group-based indentation for better readability
* Support for various input types:
    * Objects
    * Arrays
    * Primitives (strings, numbers)
    * Multiple arguments
* Async trace functions:
    * `tfia()`: Async function entry logging
    * `tfoa()`: Async function exit logging
* initial commit ([10c7e88](https://github.com/cascading-jox/av-log/commit/10c7e88b7ba62297ec9b5bf4114fd8f127bb2282))

### Maintenance

* add license ([2974e2e](https://github.com/cascading-jox/av-log/commit/2974e2ea88509048ab429520c27f8299c1059a69))
* modify package.json ([5ec81a8](https://github.com/cascading-jox/av-log/commit/5ec81a8aeae543e4f9f254c6796d1deaadbaed25))

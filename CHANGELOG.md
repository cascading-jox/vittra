# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- URL parameter support for debug level override via `avLogLevel` parameter

## [0.1.0] - 2025-01-16

### Added

- Core logging functionality with context-aware depth tracking
- Logging functions:
    - `tfi()`: Function entry logging with arguments
    - `tfo()`: Function exit logging with return values
    - `tf()`: Standard logging with + prefix
    - `tfc()`: Clean logging without formatting
    - `tfw()`: Warning logging
    - `tfe()`: Error logging
    - `tft()`: Table logging
- Time tracking features:
    - Optional time logging for function calls
    - Delta time display
    - Automatic time formatting (ms, s, mm:ss)
- Configuration options:
    - Debug level control
    - Time logging toggle
    - Type formatting toggle
- Console group-based indentation for better readability
- Support for various input types:
    - Objects
    - Arrays
    - Primitives (strings, numbers)
    - Multiple arguments
- New async trace functions:
  - `tfia()`: Async function entry logging
  - `tfoa()`: Async function exit logging

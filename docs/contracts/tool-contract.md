# Tool Contract

## Purpose

Defines how Codexia tools communicate with the Agent Runtime.


## Tool Requirements

Every tool should define:

- name
- purpose
- input schema
- output schema
- failure behaviour


## Example

filesystem.write

Input:

- path
- content


Output:

- success
- failure
- metadata


## Principle

Tools should be predictable, observable, and safe.
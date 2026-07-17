# ADR-002: Model Provider Architecture

Status: Accepted

Date: July 2026


## Context

AI models evolve quickly.

Codexia should not depend on one provider.


## Decision

Use a provider abstraction layer.

Supported providers may include:

- OpenAI
- Anthropic
- Ollama
- local models


The Agent Runtime communicates through a common interface.


## Consequences

Benefits:

- flexibility
- provider independence
- easier experimentation
- local/private deployments


Tradeoff:

Additional abstraction must be maintained.
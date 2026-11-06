# 0003: No hosted demo. Judges run it locally with the README

**Status:** Accepted by Kate, 6 Nov 2026. This replaces "Hosted URL with demo login" in the PRD (sections 7 and 14).

## Context
The PRD planned a hosted URL with one demo login. The hackathon rules accept either a hosted demo URL or "complete setup and run instructions in the repository". Hosting would put PayPal sandbox and Anthropic keys on a public server, and would need login and abuse protection that the judges don't score.

## Decision
- No hosted demo and no demo login.
- Judges clone the public repo and follow the README (`npm install`, `.env.local`, `npm run dev`).
- Kate's sandbox Client ID and Secret go in Devpost's private testing instructions field, never in the repo. With them, judges see the same sandbox disputes and orders as the video.
- The case screen uses recorded AI results, so judges don't need an Anthropic key to see it.

## Consequences
- Render is not used, so we don't enter the Render sponsor prize.
- The sandbox app and its test accounts must stay active until judging ends (15 Dec 2026).

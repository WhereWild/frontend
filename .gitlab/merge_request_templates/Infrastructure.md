<!--
SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)

SPDX-License-Identifier: AGPL-3.0-or-later
-->

## Summary

[What infrastructure, tooling, configuration, or workflow change does this MR introduce?  
Why is this needed?]

## Scope of Change

[Describe *what areas of the system this affects*. Be explicit—CI, scripts, environment, caching, build process, linting, design system integration, app deployment, etc.]

Examples:

- CI/CD pipeline adjustments
- Build tooling updates (Expo, Vite, Metro, TS config)
- WhereWild Design System token sync fixes
- Lint/prettier/husky setup
- Environments (.env, secrets, variable changes)
- Dependency upgrades

## Changes

[List the changes in a bullet list.]

- Add/modify CI job ___
- Update dependency ___
- Add/modify environment variable ___
- Improve build script ___
- Replace/remove deprecated tool ___

## Rationale

[Explain why this solution was chosen over alternatives. Briefly mention benefits (stability, speed, clarity, maintainability).]

## How to Test

[Clear instructions to test the infrastructure. Adapt the bullet list below.]

Examples:

- Run `npm install` / `npm run lint` / `npm run build`
- Validate Storybook loads correctly
- Verify WhereWild Design System token sync works
- Confirm Expo builds successfully on iOS/Android
- Check pipelines pass in GitLab
- Confirm environment is correct via logs or CLI tools

## Checklist

[A checklist for developers to follow to review.]

- [ ] CI pipelines pass
- [ ] Build succeeds on web and mobile
- [ ] No environment variable regression
- [ ] No broken scripts or missing dependencies
- [ ] No leftover debug prints
- [ ] Updated docs if needed (.md files, README)
- [ ] Infra change is backwards compatible **or** breaking change is documented

## Dependencies

[If this infra update requires other MRs, SDS updates, or design/ops approvals. If none, put N/A.]

- Affects backend? (Yes/No)
- Requires design system repo update? (Yes/No)
- Requires env var change in GitLab CI/CD? (Yes/No)
- Adds/removes dependency: ___
- Breaks compatibility with ___

## Notes

[Any caveats, rollout instructions, follow-up MRs, or version pinning. If none, put N/A.]

## Issues

- Closes #_
- Related to #_

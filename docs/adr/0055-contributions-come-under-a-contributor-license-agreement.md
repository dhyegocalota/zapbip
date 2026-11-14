# 0055. Contributions come under a contributor license agreement

- Status: Accepted
- Date: 2026-11-14
- Deciders: Dhyego Calota (owner); Claude (advisor)
- Inspired by: the owner's words of 2026-11-14 ("keep the AGPL for now, with a CLA for sure, because I am not sure about the license yet")

## Context

The server, the site and the libraries are under the AGPL-3.0 and the client packages under the MIT License. Without an agreement, every outside contribution stays under those terms only, so Logic Bit could not later move the project to another license, such as a source-available or commercial one, without the consent of every contributor.

## Decision

Every contribution comes under `.github/CLA.md`: the contributor keeps the copyright and grants Logic Bit AI Software Boutique Ltda a perpetual, irrevocable copyright license that includes relicensing under any terms, plus a patent license, and confirms the work is theirs to give. The pull request template carries a checkbox for it, CONTRIBUTING links it, and a pull request without the box ticked is not merged. The AGPL-3.0 and MIT terms of the repository do not change.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| No agreement (inbound equals outbound) | Nothing for contributors to read | The license can never change without every contributor | The owner is not sure about the license yet |
| Developer Certificate of Origin sign-off | Light, common | Certifies origin only; grants no right to relicense | Does not keep the license open |
| Copyright assignment | Strongest position for the company | Heavy, scares contributors, formalities differ by country | More than relicensing needs |
| A CLA bot in GitHub Actions | Enforced automatically | Runs on every pull request, the Actions billing is off and the owner wants fewer runs | A checkbox and a review are enough at this size |

## Consequences

Contributors read one page before their first pull request. The agreement text should be reviewed by a lawyer before the repository is public; it is written plainly, not drafted by counsel.

## Evidence

`tools/repository-shape/src/open-source.test.ts` checks that the agreement names the company and its grants, and that CONTRIBUTING and the pull request template ask for it.

## Revisit when

The license is decided, outside contributions grow enough to need an automated check, or counsel rewrites the agreement.

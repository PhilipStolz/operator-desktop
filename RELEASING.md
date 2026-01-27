# Releasing (Electron Forge + GitHub Actions)

This repository publishes end-user downloads via GitHub Releases.
A release build is triggered by pushing a git tag like v0.0.5.

Preconditions
- You are on branch main and it is up to date
- package.json contains the correct version
- GitHub Actions workflow "Release" exists
- Releases are created as Draft first so assets can be verified

Release steps (commands)

1) Update local main

Command:
 git checkout main
 git pull origin main

2) Bump version in package.json

Edit package.json and set the version field to the new version, for example 0.0.5.

Then commit:
 git add package.json package-lock.json
 git commit -m "chore: bump version to 0.0.5"
 git push origin main

3) Create and push the release tag

Use the same version as in package.json, prefixed with v.

Command:
 git tag v0.0.5
 git push origin v0.0.5

This triggers the GitHub Actions workflow "Release" which builds artifacts for Windows, macOS, and Linux and uploads them to a GitHub Draft Release.

Verify and publish (GitHub UI)

1) Go to GitHub -> Repository -> Actions
2) Open the workflow run for the tag (for example v0.0.5)
3) Wait until all jobs are green
4) Go to GitHub -> Repository -> Releases
5) Open the newest Draft release
6) Verify that assets are present
   - Windows: Setup.exe, .nupkg, RELEASES
   - macOS: .dmg, .zip
   - Linux: .deb, .rpm
7) If everything looks correct, click Publish release

Hotfix release

For a quick fix:
1) Apply the fix on main
2) Bump the version, for example to 0.0.6
3) Create and push tag v0.0.6
4) Verify the draft release and publish it

Notes

- Tag and version must match. If package.json says 0.0.5, the tag must be v0.0.5.
- Do not commit build outputs such as out/ or dist/.
- Do not reuse an existing tag for a different build. Always bump the version.


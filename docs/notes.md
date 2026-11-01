# Technical Notes — TaskPilot-WebApp

## 1. The biggest Docker problem I faced (and how I solved it)

### Problem: `"/app/node_modules": not found` during the multi-stage build

My Dockerfile has three stages: `test` → `deps` → `runtime`. The `deps` stage runs
`npm ci --omit=dev`, and the runtime stage copies the result:

```dockerfile
COPY --from=deps /app/node_modules ./node_modules
```

The build failed with:

```
ERROR: failed to calculate checksum of ref ...: "/app/node_modules": not found
```

**Cause:** TaskPilot has **zero runtime dependencies** (it uses only Node's built-in modules).
When there is nothing to install, `npm ci` does **not** create a `node_modules` folder, so the
`COPY --from=deps` step had nothing to copy.

**Solution:** make the folder exist explicitly in the `deps` stage:

```dockerfile
RUN npm ci --omit=dev \
 && mkdir -p node_modules \
 && npm cache clean --force
```

Now the Dockerfile works both today (no dependencies) and in the future if dependencies are added.

### Second problem: the tests were silently skipped

After fixing the first error, the image built — but I noticed the test output was missing from the log.
**BuildKit only builds the stages the final target depends on**, and my `runtime` stage did not use
anything from the `test` stage, so the whole `test` stage was skipped.

**Solution:** copy the source code into the runtime image **from the test stage**:

```dockerfile
COPY --from=test --chown=node:node /app/src ./src
```

This creates a real dependency, so every `docker build` now runs the 12 tests first, and a failing test
stops the build.

### Other Docker decisions

| Decision | Why |
|---|---|
| `HOST=0.0.0.0` | Binding to `localhost` inside a container makes the app unreachable from the host. |
| Exec-form `CMD ["node", "src/server.js"]` | Node becomes PID 1 and receives `SIGTERM`, so `docker stop` shuts down gracefully instead of waiting 10s and killing it. |
| `USER node` | Least privilege — the app does not need root. |
| Volume at `/app/data` | Container filesystems are temporary; the volume keeps tasks after `docker rm`. |
| Healthcheck in Node | Alpine image has no `curl`; a tiny Node script avoids installing extra packages. |
| `.dockerignore` | Keeps `node_modules`, `.git`, local `data/` and docs out of the build context (faster, smaller, no leaked local data). |

## 2. The most important Git/GitHub lesson I learned

**Small, meaningful commits tell the story of the project.**
Instead of one big "final" commit, I committed each logical step separately
(`feat:` structure → `chore:` ignore files → `docker:` Dockerfile → `fix:` build issues → `docs:` README → `ci:` pipeline).
This makes the history readable, makes it easy to find *when* and *why* something changed
(`git log`, `git blame`), and lets me revert one change without losing everything else.

I also used a **feature branch + Pull Request** for the CI work instead of pushing directly to `main`:
the PR shows the change, its description and screenshots, and GitHub Actions runs on it
**before** it is merged — so `main` always stays in a working state.

Other lessons:

- Write `.gitignore` **before** the first commit — once `node_modules/` or `data/` is committed it stays in history.
- Never commit secrets; commit a `.env.example` instead of `.env`.
- Use a clear message convention (`feat`, `fix`, `docs`, `chore`, `docker`, `ci`, `test`) so the purpose of every commit is obvious.

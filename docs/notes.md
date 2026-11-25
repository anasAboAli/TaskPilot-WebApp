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

---

# Assignment 3 — Deploying to a VPS: challenges and how I solved them

**Final setup:** iximiuz Labs Ubuntu playground (cloud microVM with a browser terminal) →
Git + Docker installed manually → repo cloned from GitHub → image built with the same Dockerfile →
container running on port 80 → port exposed publicly through the provider's dashboard.

### 1. The recommended provider no longer exists, and I have no payment card
The suggested provider (ClawCloud Run) shut down its free tier in May 2026, so it was not an option.
Most cloud providers (AWS, Google Cloud, Oracle, DigitalOcean…) require a credit card for
verification, which I don't have. I compared card-free options: student cloud credits need a
verified university mailbox, and the old browser Docker sandboxes (Play with Docker) were also
discontinued. I chose **iximiuz Labs**, which gives a real Linux VM (own kernel, systemd, networking),
not a container pretending to be a server, with a browser terminal — the same way of working the
assignment describes.

### 2. `permission denied` on `/var/run/docker.sock`
After installing Docker with the official `get.docker.com` script, `docker run hello-world` failed:

```
permission denied while trying to connect to the docker API at unix:///var/run/docker.sock
```

**Cause:** the Docker daemon socket belongs to `root` and the `docker` group. My user (`laborant`) was
added to the group with `usermod -aG docker`, but group membership only applies to **new login
sessions**, and the usual shortcut `newgrp docker` was not installed on the image
(`newgrp: command not found`).

**Solution:** run Docker commands with `sudo` (e.g. `sudo docker build …`, `sudo docker run …`).
The alternative is to log out and back in so the new group is applied. I documented both in the README.

### 3. Making the app reachable from the internet
The playground VM sits behind the provider's proxy, so it has no directly reachable public IP.

- I published the container on the standard HTTP port: `-p 80:3000`, so the URL needs no port number.
- The app already listens on `0.0.0.0` (set in the Dockerfile), which is required — binding to
  `localhost` inside a container would make it unreachable from outside.
- In the dashboard I used **Expose Port → 80**. Exposed ports are **private by default** (only the
  owner can open them), so I had to switch access to **Public** before the link worked for others.
- The provider gives an HTTPS URL, verified with the UI and with `/health` and `/api/tasks`.

### 4. Free-tier limits: session time and temporary URL
The free plan limits daily VM time and the VM is deleted when the session ends, so the public URL is
temporary. To deal with this I:

- prepared every command before starting the session, so the whole deployment took only a few minutes;
- used `--restart unless-stopped` and a named volume (`taskpilot-data`) so the app survives container
  restarts while the server is up;
- captured screenshots of each step as proof, and wrote the README so the deployment can be repeated on
  any Ubuntu server in a few commands (plus `scripts/deploy-vps.sh` to do it in one).

### What I learned
Moving from "works on my machine" to production is mostly about the environment, not the code: the
Docker image built and passed its tests on the first try on the server — exactly because it was
already containerized in Assignment 2. The real work was in the server itself: users and groups
(`docker` group), ports and network exposure, and the limits of the hosting plan.

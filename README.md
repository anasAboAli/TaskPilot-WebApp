# TaskPilot-WebApp

![Docker CI](https://github.com/anasAboAli/TaskPilot-WebApp/actions/workflows/docker-ci.yml/badge.svg)
![Node.js](https://img.shields.io/badge/Node.js-22-339933?logo=node.js&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-blue)

**TaskPilot** is a lightweight task-management web application: a REST API plus a clean web UI to create, filter, search, track and complete tasks. It is written in **pure Node.js (zero runtime dependencies)** and packaged to run anywhere with **Docker** in one command.

![TaskPilot UI](docs/screenshots/05-app-ui.png)

## 🌐 Production URL

The app is deployed on a Linux VPS (Ubuntu) and running inside Docker:

| | |
|---|---|
| **Live app** | **https://6b06d19ae9f9e88e85e777b0-11a0f1.node-eu-11b2.iximiuz.com** |
| **Health check** | https://6b06d19ae9f9e88e85e777b0-11a0f1.node-eu-11b2.iximiuz.com/health |
| **API** | https://6b06d19ae9f9e88e85e777b0-11a0f1.node-eu-11b2.iximiuz.com/api/tasks |
| **Provider** | iximiuz Labs — Ubuntu playground (cloud microVM, browser terminal) |
| **Container** | `taskpilot` — host port `80` → container port `3000` |

> **Note:** the server is a free cloud VM with a limited session time, so the public URL above is
> temporary and stops responding when the session ends. The deployment was verified while it was live —
> see the [production screenshots](#production-vps-assignment-3). Redeploying on any Ubuntu server takes
> the few commands in [Deploy to Production (VPS)](#deploy-to-production-vps).

---

## Features

- Create tasks with title, description, priority (`low` / `medium` / `high`) and due date
- Move tasks through statuses: `todo` → `in_progress` → `done`
- Filter by status and priority, and full-text search
- Live dashboard: totals per status and **overdue** counter
- Input validation with clear error messages (`422`)
- Data persisted to a JSON file stored in a **Docker volume** (survives container restarts)
- `/health` endpoint used by the Docker **HEALTHCHECK**
- Graceful shutdown on `SIGTERM` (`docker stop`)
- Automated tests (Node's built-in test runner) that run **inside the Docker build**

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 22 (built-in `http`, `fs`, `crypto` modules) |
| Frontend | HTML, CSS, vanilla JavaScript (served by the same server) |
| Storage | JSON file with atomic writes (`/app/data/tasks.json`) |
| Tests | `node:test` + `fetch` |
| Containers | Docker (multi-stage build), Docker Compose |
| CI | GitHub Actions (tests + Docker build + smoke test) |

## Project Structure

```
TaskPilot-WebApp/
├── src/
│   ├── server.js            # entry point (starts HTTP server, graceful shutdown)
│   ├── app.js               # routes & request handling
│   ├── http.js              # tiny router + JSON helpers
│   ├── validation.js        # input validation
│   ├── config.js            # environment configuration
│   ├── store/taskStore.js   # JSON-file persistence
│   └── public/              # web UI (index.html, app.js, styles.css)
├── tests/api.test.js        # API & UI tests
├── scripts/
│   ├── healthcheck.js       # used by Docker HEALTHCHECK
│   └── deploy-vps.sh        # one-shot VPS deployment
├── .github/workflows/       # CI pipeline
├── docs/
│   ├── screenshots/         # assignment screenshots (vps/ = Assignment 3)
│   └── notes.md             # technical notes
├── Dockerfile
├── docker-compose.yml
├── Makefile
├── .dockerignore
├── .gitignore
├── .env.example
└── LICENSE
```

---

## Quick Start (Docker)

**Prerequisites:** [Docker](https://docs.docker.com/get-docker/) installed and running. Nothing else (no Node.js needed).

### 1. Clone the repository

```bash
git clone https://github.com/anasAboAli/TaskPilot-WebApp.git
cd TaskPilot-WebApp
```

### 2. Build the image

```bash
docker build -t taskpilot-webapp .
```

> The build runs the test suite. If any test fails, the build fails.

### 3. Run the container

```bash
docker run -d --name taskpilot -p 3000:3000 -v taskpilot-data:/app/data taskpilot-webapp
```

Open **http://localhost:3000** 🎉

### 4. Check it is running

```bash
docker ps                      # STATUS should become "Up ... (healthy)"
docker logs taskpilot          # view request logs
```

### 5. Stop and clean up

```bash
docker stop taskpilot          # stop the container (graceful shutdown)
docker rm taskpilot            # remove the container
docker rmi taskpilot-webapp    # (optional) remove the image
docker volume rm taskpilot-data  # (optional) delete saved tasks
```

---

## Option B — Docker Compose (one command)

```bash
docker compose up -d --build   # build & start
docker compose ps              # status (healthy)
docker compose logs -f         # logs
docker compose down            # stop & remove container
docker compose down -v         # ...and delete the data volume
```

## Option C — Makefile shortcuts

```bash
make help     # list all commands
make build    # build the image
make run      # run on http://localhost:3000
make health   # show container health status
make logs     # follow logs
make stop     # stop & remove the container
make test     # run tests inside Docker
make clean    # remove container, image and volume
```

> On Windows, `make` is available through Git Bash/WSL — or just use the Docker commands above.

---

## Deploy to Production (VPS)

These steps deploy TaskPilot on any Ubuntu VPS (tested on an Ubuntu cloud VM). The server
clones **this GitHub repository** and builds the image with the **same Dockerfile** used locally.

### 1. Create the server and open the terminal

- Create an Ubuntu 22.04/24.04 instance (1 vCPU / 1 GB RAM is enough).
- Allow inbound **HTTP (port 80)** in the provider's firewall / network security group.
- Connect with the provider's browser terminal, or with SSH:

```bash
ssh <user>@<VPS_IP>
```

### 2. Install Git and Docker (and verify)

```bash
sudo apt-get update
sudo apt-get install -y git curl
curl -fsSL https://get.docker.com | sudo sh     # official Docker install script
sudo systemctl enable --now docker
git --version
docker --version
sudo docker run --rm hello-world                  # confirms the Docker engine works
```

> **Permission note:** a normal user gets `permission denied ... /var/run/docker.sock` until it is in the
> `docker` group *and* has logged in again. Either prefix Docker commands with `sudo` (as below), or run
> `sudo usermod -aG docker $USER` and open a new login session.

### 3. Clone the repository

```bash
git clone https://github.com/anasAboAli/TaskPilot-WebApp.git
cd TaskPilot-WebApp
```

### 4. Build the image

```bash
sudo docker build -t taskpilot-webapp .     # the test suite runs during the build
```

### 5. Run the container

```bash
sudo docker run -d --name taskpilot \
  --restart unless-stopped \
  -p 80:3000 \
  -v taskpilot-data:/app/data \
  taskpilot-webapp
```

- `-p 80:3000` publishes the app on the standard HTTP port, so the URL needs no port number.
- `--restart unless-stopped` brings the app back after a server reboot.

### 6. Verify

```bash
sudo docker ps                          # STATUS: Up ... (healthy)
curl http://localhost/health            # {"status":"ok",...}
curl http://localhost/api/tasks
```

Then open **http://&lt;VPS_IP&gt;** from any browser. If the provider puts the VM behind a proxy (as iximiuz Labs does), publish port 80 from its dashboard (**Expose Port → 80 → Public**) and use the generated HTTPS URL.

### Updating the deployment

```bash
cd ~/TaskPilot-WebApp
git pull
sudo docker build -t taskpilot-webapp .
sudo docker rm -f taskpilot
sudo docker run -d --name taskpilot --restart unless-stopped -p 80:3000 -v taskpilot-data:/app/data taskpilot-webapp
```

### One-command alternative

`scripts/deploy-vps.sh` performs all the steps above (installs Git/Docker if missing, clones or pulls, builds, runs):

```bash
curl -fsSL https://raw.githubusercontent.com/anasAboAli/TaskPilot-WebApp/main/scripts/deploy-vps.sh | bash
```

Or with Docker Compose on the VPS: `HOST_PORT=80 docker compose up -d --build`.

---

## Configuration

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Port the server listens on inside the container |
| `HOST` | `0.0.0.0` | Interface to bind (must be `0.0.0.0` inside Docker) |
| `DATA_DIR` | `/app/data` | Folder where `tasks.json` is stored |
| `HOST_PORT` | `3000` | (Compose only) port published on your machine |

No secrets or environment values are required. If port 3000 is busy on your machine, map another one:

```bash
docker run -d --name taskpilot -p 8080:3000 taskpilot-webapp   # → http://localhost:8080
# or with Compose:
HOST_PORT=8080 docker compose up -d
```

---

## How to Test

### In the browser
1. Open http://localhost:3000
2. Add a task (e.g. *"Prepare presentation"*, priority **High**, due date tomorrow)
3. Click **→ In progress**, then tick the checkbox to mark it **Done**
4. Use the search box and filters; watch the counters update
5. Restart the container (`docker restart taskpilot`) — your tasks are still there

### With the API (curl)

```bash
# Health
curl http://localhost:3000/health

# Create a task
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"Submit OS assignment","priority":"high","dueDate":"2026-12-31"}'

# List tasks (with optional filters)
curl "http://localhost:3000/api/tasks?status=todo&priority=high&q=assignment"

# Update a task status (replace <id>)
curl -X PATCH http://localhost:3000/api/tasks/<id> \
  -H "Content-Type: application/json" -d '{"status":"done"}'

# Statistics
curl http://localhost:3000/api/stats

# Delete
curl -X DELETE http://localhost:3000/api/tasks/<id>
```

### API reference

| Method | Endpoint | Description | Success |
|---|---|---|---|
| GET | `/health` | Health status, version, uptime | 200 |
| GET | `/api/tasks` | List tasks (`?status=`, `?priority=`, `?q=`) | 200 |
| POST | `/api/tasks` | Create a task | 201 |
| GET | `/api/tasks/:id` | Get one task | 200 |
| PATCH | `/api/tasks/:id` | Update fields of a task | 200 |
| DELETE | `/api/tasks/:id` | Delete a task | 204 |
| GET | `/api/stats` | Counts by status/priority + overdue | 200 |

Errors return JSON: `400` invalid JSON, `404` not found, `405` wrong method, `422` validation errors.

### Automated tests

```bash
make test                 # inside Docker
# or locally (Node.js 20+):
npm test
```

---

## Docker Design Notes

- **Multi-stage build:** `test` (runs tests) → `deps` (production deps only) → `runtime` (final small image). The runtime stage copies the source *from the test stage*, so tests always run before an image is produced.
- **Small base image:** `node:22-alpine`.
- **Security:** runs as the non-root `node` user.
- **Layer caching:** `package*.json` is copied before the source code.
- **HEALTHCHECK** uses a Node script (no `curl`/`wget` needed in the image).
- **Exec-form `CMD`:** Node runs as PID 1 and receives `SIGTERM` for a graceful shutdown.
- **`.dockerignore`** keeps `node_modules`, `.git`, local data and docs out of the build context.

More details and lessons learned: [docs/notes.md](docs/notes.md).

## Screenshots

### Local (Assignment 2)

| Docker build | Container running | App UI | Commit history |
|---|---|---|---|
| ![build](docs/screenshots/01-docker-build.png) | ![running](docs/screenshots/02-container-running.png) | ![ui](docs/screenshots/05-app-ui.png) | ![commits](docs/screenshots/06-github-commits.png) |

### Production VPS (Assignment 3)

| Git & Docker installed | Clone | Docker build |
|---|---|---|
| ![versions](docs/screenshots/vps/01-git-docker-versions.png) | ![clone](docs/screenshots/vps/02-git-clone.png) | ![build](docs/screenshots/vps/03-docker-build.png) |

| Running container | Live app (browser) | API response |
|---|---|---|
| ![ps](docs/screenshots/vps/04-container-running.png) | ![live](docs/screenshots/vps/05-live-app-browser.png) | ![api](docs/screenshots/vps/06-live-api-response.png) |

## Attribution

This project was designed and written from scratch for the OS Lab assignments (Docker & GitHub, then deployment to a VPS). It is not based on an existing open-source project.

## License

Released under the [MIT License](LICENSE).

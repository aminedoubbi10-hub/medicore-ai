# MediCore AI — Clinical Decision Support Platform

> AI-powered medical interpretation for ECG, Chest X-Ray, CT/MRI, Lab Results, and Vitals.  
> **Not a replacement for physicians.** Every result includes confidence scores, differential diagnoses, and mandatory clinical disclaimers.

---

## 🏗️ Architecture

```
medicore-ai/
├── frontend/          # Next.js 15 + TailwindCSS + Framer Motion
├── backend/           # FastAPI + PostgreSQL + Redis + Celery
├── docker/            # Docker Compose + Nginx + Postgres init
└── .github/workflows/ # CI/CD — GitHub Actions → AWS ECS + Vercel
```

**AI Stack:** Claude Sonnet 4 · OpenCV · pydicom · NumPy  
**Auth:** JWT (access + refresh tokens) · Role-based (doctor / radiologist / admin)  
**Security:** HIPAA-inspired · AES-256 · Audit logs · Rate limiting · RBAC

---

## ⚡ Quick Start (Local Dev)

### Prerequisites
- Docker & Docker Compose
- Node.js 20+
- Python 3.12+
- An [Anthropic API key](https://console.anthropic.com)

### 1. Clone and configure

```bash
git clone https://github.com/your-org/medicore-ai.git
cd medicore-ai
```

### 2. Backend setup

```bash
cd backend

# Copy and fill in environment variables
cp .env.example .env
# Edit .env — minimum required: ANTHROPIC_API_KEY and SECRET_KEY

# Create a virtualenv
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Start infrastructure

```bash
cd ../docker

# Copy env for docker-compose
cp .env.example .env
# Edit docker/\.env — set POSTGRES_PASSWORD, REDIS_PASSWORD, ANTHROPIC_API_KEY

# Start Postgres + Redis
docker-compose up -d postgres redis
```

### 4. Run database migrations

```bash
cd ../backend
alembic upgrade head
```

### 5. Start the backend

```bash
# Terminal 1 — FastAPI server
uvicorn app.main:app --reload --port 8000

# Terminal 2 — Celery worker (for async AI tasks)
celery -A app.workers.celery_app worker --loglevel=info
```

### 6. Start the frontend

```bash
cd ../frontend

# Install dependencies
npm install

# Copy and configure env
cp .env.local.example .env.local
# NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

**Demo credentials:**
- Email: `admin@medicore.ai`
- Password: `Admin1234!`

---

## 🐳 Full Docker Deployment

```bash
cd docker
docker-compose up -d --build
```

This starts: PostgreSQL · Redis · FastAPI · Celery Worker · Celery Beat · Flower · Nginx

- API: http://localhost:8000
- Frontend: http://localhost:3000
- Flower (task monitor): http://localhost:5555
- API docs (dev only): http://localhost:8000/api/docs

---

## ☁️ Production Deployment

### Frontend → Vercel

```bash
cd frontend
npm install -g vercel
vercel --prod
```

Set environment variables in Vercel dashboard:
```
NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api/v1
```

### Backend → AWS ECS

1. Create ECR repository: `medicore-backend`
2. Create ECS cluster: `medicore-production`
3. Create ECS service: `medicore-backend`
4. Set GitHub secrets:
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `VERCEL_TOKEN`
   - `VERCEL_ORG_ID`
   - `VERCEL_PROJECT_ID`
   - `ANTHROPIC_API_KEY`
5. Push to `main` — CI/CD handles the rest

### Required AWS services
- **ECS Fargate** — container hosting
- **RDS PostgreSQL** — managed database
- **ElastiCache Redis** — caching + Celery broker
- **S3** — medical file storage (encrypted)
- **ALB** — load balancer + SSL termination
- **Route 53** — DNS

---

## 🔑 Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Description |
|---|---|---|
| `SECRET_KEY` | ✅ | 256-bit JWT signing key (`openssl rand -hex 32`) |
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `REDIS_URL` | ✅ | Redis connection string |
| `ANTHROPIC_API_KEY` | ✅ | Claude API key from console.anthropic.com |
| `AWS_ACCESS_KEY_ID` | Optional | For S3 file storage |
| `AWS_SECRET_ACCESS_KEY` | Optional | For S3 file storage |
| `S3_BUCKET` | Optional | S3 bucket name |
| `ENVIRONMENT` | Optional | `development` or `production` |

### Frontend (`frontend/.env.local`)

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | ✅ | Backend API URL |

---

## 🧪 Running Tests

```bash
cd backend
pytest tests/ -v --cov=app
```

---

## 📋 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/v1/auth/login` | Authenticate user |
| POST | `/api/v1/auth/register` | Register new user |
| POST | `/api/v1/auth/refresh` | Refresh JWT token |
| GET | `/api/v1/patients` | List patients |
| POST | `/api/v1/patients` | Create patient |
| POST | `/api/v1/ecg/upload` | Upload & analyze ECG |
| GET | `/api/v1/ecg/{id}/result` | Get ECG analysis result |
| POST | `/api/v1/xray/upload` | Upload & analyze chest X-ray |
| POST | `/api/v1/labs/interpret` | Interpret lab panel |
| POST | `/api/v1/reports/generate` | Generate clinical report |
| GET | `/api/v1/alerts` | List alerts |
| POST | `/api/v1/alerts/{id}/acknowledge` | Acknowledge alert |
| GET | `/health` | Health check |

Full interactive docs (dev mode): `http://localhost:8000/api/docs`

---

## 🗺️ Roadmap

| Priority | Feature |
|---|---|
| High | Replace heuristic ECG/CXR models with trained PyTorch weights (CardioNet, CheXNet) |
| High | Full DICOM server integration via Orthanc PACS |
| High | WebSocket push for real-time AI results (replace polling) |
| High | HL7 FHIR R4 integration for HIS/EMR connectivity |
| Medium | PDF export with digital physician signature |
| Medium | Federated learning across hospital sites |
| Medium | React Native mobile app for bedside use |
| Low | Multi-tenant SaaS with per-hospital isolation |
| Low | Voice dictation for report generation |

---

## ⚖️ Medical & Legal Disclaimer

MediCore AI is a **clinical decision support tool** intended to assist licensed medical professionals. It is **not** a medical device and does **not** replace physician judgment.

- All AI outputs include confidence scores and uncertainty flags
- Every result contains a mandatory clinical disclaimer
- Final diagnosis and treatment decisions rest with the treating physician
- Before clinical deployment, consult your local regulatory body (FDA 510(k), CE marking, etc.)

---

## 📄 License

MIT License — see LICENSE file for details.

Built with ❤️ for the medical community.

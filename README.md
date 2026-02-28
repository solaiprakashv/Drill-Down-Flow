# 🛠️ Complete Workflow Setup & Development Process (Bash Included)

This section explains the full setup and execution process of the Drill-Down-Flow application using Bash/Terminal.

---

## 📌 1️⃣ Prerequisites

Make sure the following are installed:

- Node.js (v18+ recommended)
- npm
- Git
- MongoDB or Neo4j (based on your configuration)

Verify installation:

```bash
node -v
npm -v
git --version
```

---

## 📥 2️⃣ Clone the Repository

```bash
git clone https://github.com/solaiprakashv/Drill-Down-Flow.git
cd Drill-Down-Flow
```

---

## 🌿 3️⃣ Create & Switch to Main Branch (If Needed)

```bash
git branch -M main
```

---

## 🔧 4️⃣ Backend Setup Process

Navigate to backend:

```bash
cd backend
```

Install dependencies:

```bash
npm install
```

Create environment file:

```bash
touch .env
```

Example `.env` configuration:

```bash
PORT=5000
MONGO_URI=your_mongodb_connection_string
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your_password
```

Start backend server:

```bash
npm run dev
```

Backend will run at:

```
http://localhost:5000
```

---

## 🎨 5️⃣ Frontend Setup Process

Open new terminal and navigate:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

Start frontend:

```bash
npm start
```

Frontend will run at:

```
http://localhost:3000
```

---

## 🔁 6️⃣ Full Development Workflow

Whenever making changes:

```bash
git status
git add .
git commit -m "Describe your changes"
git push
```

---

## 🧠 7️⃣ Application Flow Process

1. User submits paragraph input
2. Backend decomposes text recursively
3. Structured nodes and relationships are generated
4. Data stored in Graph/Document database
5. Linked flows are retrieved via API
6. Frontend visualizes structured data
7. CRUD operations supported for all entities

---

## 🏗️ 8️⃣ Architecture Flow

User → Frontend (React) → Backend API (Express/FastAPI) → Database (Neo4j/MongoDB)

---

## 🚀 9️⃣ Production Deployment (Optional Future Step)

```bash
npm run build
```

Deploy backend to:
- Render / Railway / AWS / Azure

Deploy frontend to:
- Vercel / Netlify

---

## ✅ 10️⃣ Project Execution Summary

1. Clone project
2. Setup backend
3. Configure database
4. Setup frontend
5. Run both servers
6. Perform CRUD operations
7. Push updates to GitHub

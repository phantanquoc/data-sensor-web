# Stage 1: Build the React client
FROM node:22-alpine AS client-build

WORKDIR /app/client

COPY client/package*.json ./
RUN npm ci

COPY client/ ./
RUN npm run build

# Stage 2: Production runtime
FROM node:22-alpine

WORKDIR /app

# Install backend dependencies (omit dev)
COPY package*.json ./
RUN npm install --omit=dev

# Copy backend source
COPY . .

# Copy built client from stage 1
COPY --from=client-build /app/client/dist ./client/dist

EXPOSE 3000

CMD ["node", "app.js"]

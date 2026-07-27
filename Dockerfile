# Backend: API + Socket.IO + Modbus poller.
# KHÔNG build/serve React nữa — frontend là service riêng (Dockerfile.frontend, port 5174).
FROM node:22-alpine

WORKDIR /app

# Backend dependencies (bỏ devDependencies)
COPY package*.json ./
RUN npm install --omit=dev

# Backend source
COPY . .

EXPOSE 3000

CMD ["node", "app.js"]
